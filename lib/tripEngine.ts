// ============================================
// Trip engine
// Turns raw location samples into trips. It runs inside the background
// location task, so all state is persisted to AsyncStorage after each
// batch and nothing depends on React or on timers (JS timers do not run
// reliably in the background).
// ============================================

import AsyncStorage from '@react-native-async-storage/async-storage';
import { KEYS, Trip, Coord, appendTrip } from './storage';

export const START_SPEED_KMH = 15; // auto-start threshold
export const START_CONFIRM_SAMPLES = 2; // consecutive samples above threshold
export const MOVING_SPEED_KMH = 5; // below this counts as stopped
export const AUTO_STOP_MS = 3 * 60 * 1000; // stopped this long -> trip ends
export const MIN_TRIP_KM = 0.2; // shorter trips are discarded
const SPEEDING_KMH = 130;
const SPEEDING_COOLDOWN_MS = 30 * 1000;
const EVENT_COOLDOWN_MS = 5 * 1000;
const HARD_BRAKE_KMH_PER_S = -12; // ~0.34 g
const HARD_ACCEL_KMH_PER_S = 11; // ~0.31 g
const MAX_ACCURACY_M = 100;
const MAX_PLAUSIBLE_KMH = 250;

export interface Sample {
  t: number;
  latitude: number;
  longitude: number;
  speed: number; // km/h
  accuracy: number | null;
}

export interface ActiveTrip {
  id: string;
  source: 'auto' | 'manual';
  startedAt: number;
  startCoord: Coord;
  lastCoord: Coord;
  distance: number;
  maxSpeed: number;
  speedSum: number;
  speedCount: number;
  hardBrakes: number;
  hardAccel: number;
  speedingEvents: number;
  lastMovingAt: number;
  lastSpeedingAt: number;
  lastEventAt: number;
}

interface EngineState {
  active: ActiveTrip | null;
  last: Sample | null;
  startCandidates: number;
  firstCandidate: Sample | null;
}

export type EngineEvent =
  | { type: 'sample'; speed: number; active: ActiveTrip | null }
  | { type: 'started'; trip: ActiveTrip }
  | { type: 'finished'; trip: Trip | null; reason: 'auto' | 'manual' }
  | { type: 'brake' }
  | { type: 'speeding' };

const emptyState = (): EngineState => ({
  active: null,
  last: null,
  startCandidates: 0,
  firstCandidate: null,
});

let state: EngineState | null = null;
let queue: Promise<unknown> = Promise.resolve();
const listeners = new Set<(e: EngineEvent) => void>();

export function subscribe(fn: (e: EngineEvent) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit(e: EngineEvent) {
  listeners.forEach((fn) => {
    try {
      fn(e);
    } catch (err) {
      console.warn('[DriveIQ] listener error', err);
    }
  });
}

// Runs jobs one after another so overlapping location batches can't race.
function serial<T>(job: () => Promise<T>): Promise<T> {
  const run = queue.then(job, job);
  queue = run.catch(() => undefined);
  return run;
}

async function load(): Promise<EngineState> {
  if (state) return state;
  try {
    const raw = await AsyncStorage.getItem(KEYS.engine);
    state = raw ? { ...emptyState(), ...JSON.parse(raw) } : emptyState();
  } catch {
    state = emptyState();
  }
  return state!;
}

async function persist() {
  if (state) await AsyncStorage.setItem(KEYS.engine, JSON.stringify(state));
}

function haversineKm(a: Coord, b: Coord): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function calculateScore(t: { hardBrakes: number; hardAccel: number; speedingEvents: number }) {
  return Math.max(0, Math.min(100, Math.round(100 - t.hardBrakes * 4 - t.hardAccel * 4 - t.speedingEvents * 8)));
}

function newTrip(source: 'auto' | 'manual', at: Sample): ActiveTrip {
  const coord = { latitude: at.latitude, longitude: at.longitude };
  return {
    id: String(at.t),
    source,
    startedAt: at.t,
    startCoord: coord,
    lastCoord: coord,
    distance: 0,
    maxSpeed: at.speed,
    speedSum: 0,
    speedCount: 0,
    hardBrakes: 0,
    hardAccel: 0,
    speedingEvents: 0,
    lastMovingAt: at.t,
    lastSpeedingAt: 0,
    lastEventAt: 0,
  };
}

// Converts an expo-location object into a sample; null if unusable.
export function toSample(loc: any, prev: Sample | null): Sample | null {
  const c = loc?.coords;
  if (!c || !isFinite(c.latitude) || !isFinite(c.longitude)) return null;
  const t = typeof loc.timestamp === 'number' ? loc.timestamp : Date.now();
  const accuracy = typeof c.accuracy === 'number' ? c.accuracy : null;
  let speed = typeof c.speed === 'number' && c.speed >= 0 ? c.speed * 3.6 : -1;
  if (speed < 0 && prev && t > prev.t) {
    // No speed from the provider (e.g. network location): derive it.
    speed = haversineKm(prev, c) / ((t - prev.t) / 3600000);
  }
  if (!isFinite(speed) || speed < 0 || speed > MAX_PLAUSIBLE_KMH) speed = 0;
  return { t, latitude: c.latitude, longitude: c.longitude, speed, accuracy };
}

async function finish(s: EngineState, reason: 'auto' | 'manual'): Promise<Trip | null> {
  const a = s.active;
  if (!a) return null;
  s.active = null;
  s.startCandidates = 0;
  s.firstCandidate = null;

  // An auto-stopped trip ends when the car stopped, not 3 minutes later.
  const endedAt = reason === 'auto' ? a.lastMovingAt : Date.now();
  if (a.distance < MIN_TRIP_KM) {
    await persist();
    return null;
  }
  const start = new Date(a.startedAt);
  const trip: Trip = {
    id: a.id,
    startedAt: a.startedAt,
    endedAt,
    source: a.source,
    distance: parseFloat(a.distance.toFixed(2)),
    duration: Math.max(1, Math.round((endedAt - a.startedAt) / 60000)),
    score: calculateScore(a),
    avgSpeed: a.speedCount ? Math.round(a.speedSum / a.speedCount) : 0,
    maxSpeed: Math.round(a.maxSpeed),
    hardBrakes: a.hardBrakes,
    hardAccel: a.hardAccel,
    speedingEvents: a.speedingEvents,
    startCoord: a.startCoord,
    endCoord: a.lastCoord,
    date: start.toLocaleDateString(),
    time: start.toLocaleTimeString(),
  };
  // Save the trip before clearing the active trip from storage.
  await appendTrip(trip);
  await persist();
  return trip;
}

function isStale(a: ActiveTrip, now: number): boolean {
  // Manual trips only auto-end once the car has actually driven somewhere.
  if (a.source === 'manual' && a.distance < 0.5) return false;
  return now - a.lastMovingAt > AUTO_STOP_MS;
}

async function processOne(s: EngineState, sample: Sample) {
  if (s.last && sample.t <= s.last.t) return; // old or duplicate
  if (sample.accuracy != null && sample.accuracy > MAX_ACCURACY_M) return;
  const prev = s.last;
  s.last = sample;

  if (s.active && isStale(s.active, sample.t)) {
    const trip = await finish(s, 'auto');
    emit({ type: 'finished', trip, reason: 'auto' });
  }

  if (!s.active) {
    if (sample.speed >= START_SPEED_KMH) {
      s.startCandidates += 1;
      if (!s.firstCandidate) s.firstCandidate = sample;
      if (s.startCandidates >= START_CONFIRM_SAMPLES) {
        s.active = newTrip('auto', s.firstCandidate);
        s.startCandidates = 0;
        s.firstCandidate = null;
        emit({ type: 'started', trip: s.active });
      }
    } else {
      s.startCandidates = 0;
      s.firstCandidate = null;
    }
    if (!s.active) return;
  }

  const a = s.active;
  const coord = { latitude: sample.latitude, longitude: sample.longitude };
  if (a.startCoord.latitude === 0 && a.startCoord.longitude === 0) {
    // Manual trip started before the first GPS fix.
    a.startCoord = coord;
    a.lastCoord = coord;
  }
  if (prev && sample.t > prev.t) {
    const seg = haversineKm(a.lastCoord, coord);
    const segKmh = seg / ((sample.t - prev.t) / 3600000);
    if (seg < 1 && segKmh < MAX_PLAUSIBLE_KMH) a.distance += seg;

    const dt = (sample.t - prev.t) / 1000;
    if (dt >= 0.5 && dt <= 6 && sample.t - a.lastEventAt > EVENT_COOLDOWN_MS) {
      const rate = (sample.speed - prev.speed) / dt;
      if (rate <= HARD_BRAKE_KMH_PER_S && prev.speed >= 20) {
        a.hardBrakes += 1;
        a.lastEventAt = sample.t;
        emit({ type: 'brake' });
      } else if (rate >= HARD_ACCEL_KMH_PER_S) {
        a.hardAccel += 1;
        a.lastEventAt = sample.t;
      }
    }
  }
  a.lastCoord = coord;
  a.maxSpeed = Math.max(a.maxSpeed, sample.speed);
  if (sample.speed >= MOVING_SPEED_KMH) {
    a.lastMovingAt = sample.t;
    a.speedSum += sample.speed;
    a.speedCount += 1;
  }
  if (sample.speed > SPEEDING_KMH && sample.t - a.lastSpeedingAt > SPEEDING_COOLDOWN_MS) {
    a.speedingEvents += 1;
    a.lastSpeedingAt = sample.t;
    emit({ type: 'speeding' });
  }
}

export function processLocations(locations: any[]): Promise<void> {
  return serial(async () => {
    const s = await load();
    const sorted = [...locations].sort((x, y) => (x?.timestamp ?? 0) - (y?.timestamp ?? 0));
    for (const loc of sorted) {
      const sample = toSample(loc, s.last);
      if (sample) await processOne(s, sample);
    }
    await persist();
    emit({ type: 'sample', speed: s.last ? Math.round(s.last.speed) : 0, active: s.active });
  });
}

export function startManualTrip(): Promise<ActiveTrip> {
  return serial(async () => {
    const s = await load();
    if (!s.active) {
      const now = Date.now();
      const base: Sample =
        s.last && now - s.last.t < 60000
          ? { ...s.last, t: now }
          : { t: now, latitude: s.last?.latitude ?? 0, longitude: s.last?.longitude ?? 0, speed: 0, accuracy: null };
      s.active = newTrip('manual', base);
      // Without a fresh fix, the first real sample sets the start point.
      if (!s.last || now - s.last.t >= 60000) s.last = null;
      await persist();
      emit({ type: 'started', trip: s.active });
    }
    return s.active!;
  });
}

export function endTrip(): Promise<Trip | null> {
  return serial(async () => {
    const s = await load();
    const trip = await finish(s, 'manual');
    emit({ type: 'finished', trip, reason: 'manual' });
    return trip;
  });
}

// Called when the app comes to the foreground: closes a trip whose
// auto-stop moment passed while no location updates were arriving.
export function finalizeIfStale(): Promise<Trip | null> {
  return serial(async () => {
    const s = await load();
    if (!s.active || !isStale(s.active, Date.now())) return null;
    const trip = await finish(s, 'auto');
    emit({ type: 'finished', trip, reason: 'auto' });
    return trip;
  });
}

export function getActiveTrip(): Promise<ActiveTrip | null> {
  return serial(async () => (await load()).active);
}

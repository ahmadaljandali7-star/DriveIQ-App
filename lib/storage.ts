// ============================================
// Persistent storage
// Keys and the trip format are compatible with the earlier DriveIQ
// Expo app ("trips", "userName", "language", ...), so an update keeps
// the existing trip history. Trips are never deleted automatically.
// ============================================

import AsyncStorage from '@react-native-async-storage/async-storage';

export const KEYS = {
  trips: 'trips',
  tripsBackup: 'trips_backup_v1',
  userName: 'userName',
  language: 'language',
  profilePhoto: 'profilePhoto',
  powerSaving: 'powerSaving',
  autoDetect: 'autoDetect',
  engine: 'driveiq_engine_state',
};

export interface Coord {
  latitude: number;
  longitude: number;
}

export interface Trip {
  id: string;
  startedAt: number; // ms epoch
  endedAt: number; // ms epoch
  source: 'auto' | 'manual';
  distance: number; // km
  duration: number; // minutes
  score: number;
  avgSpeed: number;
  maxSpeed: number;
  hardBrakes: number;
  hardAccel: number;
  speedingEvents: number;
  startCoord: Coord | null;
  endCoord: Coord | null;
  // Legacy display fields kept for compatibility with the old app
  date?: string;
  time?: string;
}

const num = (v: unknown, fallback = 0): number => {
  const n = typeof v === 'string' ? parseFloat(v) : (v as number);
  return typeof n === 'number' && isFinite(n) ? n : fallback;
};

// Accepts trips from any earlier DriveIQ version and returns the current shape.
export function normalizeTrip(raw: any): Trip | null {
  if (!raw || typeof raw !== 'object') return null;
  const id = String(raw.id ?? Date.now());
  const duration = Math.max(1, Math.round(num(raw.duration ?? raw.duration_minutes, 1)));
  const idNum = Number(raw.id);
  const endedAt =
    num(raw.endedAt, NaN) ||
    Date.parse(raw.end_time ?? '') ||
    (isFinite(idNum) && idNum > 1e12 ? idNum : NaN) ||
    Date.now();
  const startedAt =
    num(raw.startedAt, NaN) || Date.parse(raw.start_time ?? '') || endedAt - duration * 60000;

  return {
    id,
    startedAt,
    endedAt,
    source: raw.source === 'manual' ? 'manual' : 'auto',
    distance: num(raw.distance ?? raw.distance_km),
    duration,
    score: Math.max(0, Math.min(100, Math.round(num(raw.score, 100)))),
    avgSpeed: Math.round(num(raw.avgSpeed ?? raw.avg_speed)),
    maxSpeed: Math.round(num(raw.maxSpeed ?? raw.max_speed)),
    hardBrakes: num(raw.hardBrakes ?? raw.hard_brakes),
    hardAccel: num(raw.hardAccel ?? raw.hard_accelerations),
    speedingEvents: num(raw.speedingEvents ?? raw.speeding_count),
    startCoord: raw.startCoord ?? null,
    endCoord: raw.endCoord ?? null,
    date: raw.date,
    time: raw.time,
  };
}

export async function loadTrips(): Promise<Trip[]> {
  const raw = await AsyncStorage.getItem(KEYS.trips);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(normalizeTrip)
      .filter((t): t is Trip => t !== null)
      .sort((a, b) => b.startedAt - a.startedAt);
  } catch {
    return [];
  }
}

// Before the first write by this version, keep an untouched copy of the old history.
async function ensureBackup(): Promise<void> {
  const [backup, raw] = await Promise.all([
    AsyncStorage.getItem(KEYS.tripsBackup),
    AsyncStorage.getItem(KEYS.trips),
  ]);
  if (backup === null && raw) {
    await AsyncStorage.setItem(KEYS.tripsBackup, raw);
  }
}

export async function appendTrip(trip: Trip): Promise<Trip[]> {
  await ensureBackup();
  const trips = await loadTrips();
  const next = [trip, ...trips.filter((t) => t.id !== trip.id)];
  await AsyncStorage.setItem(KEYS.trips, JSON.stringify(next));
  return next;
}

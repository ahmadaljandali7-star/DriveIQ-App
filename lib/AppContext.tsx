import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import * as FileSystem from 'expo-file-system';

import { KEYS, Trip, loadTrips } from './storage';
import { Language, Strings, translations, getDeviceLanguage, fill, LOCALE_TAG } from './i18n';
import {
  ActiveTrip,
  subscribe,
  processLocations,
  startManualTrip,
  endTrip,
  finalizeIfStale,
  getActiveTrip,
} from './tripEngine';
import {
  PermissionState,
  getPermissionState,
  requestPermissions,
  startService,
  stopService,
  isServiceRunning,
} from './locationTask';
import { computeAchievements } from './achievements';

interface Stats {
  totalTrips: number;
  totalDistance: number;
  avgScore: number;
  bestScore: number;
}

interface AppContextValue {
  isLoaded: boolean;
  t: Strings;
  language: Language;
  locale: string;
  userName: string;
  profilePhoto: string | null;
  powerSaving: boolean;
  autoDetect: boolean;
  permission: PermissionState;
  trips: Trip[];
  stats: Stats;
  activeTrip: ActiveTrip | null;
  currentSpeed: number;
  toast: string | null;
  showToast: (message: string, ms?: number) => void;
  saveUserName: (name: string) => Promise<void>;
  saveLanguage: (lang: Language) => Promise<void>;
  saveProfilePhoto: (uri: string) => Promise<void>;
  savePowerSaving: (on: boolean) => Promise<void>;
  saveAutoDetect: (on: boolean) => Promise<void>;
  askPermission: () => Promise<PermissionState>;
  startTrip: () => Promise<void>;
  stopTrip: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [language, setLanguage] = useState<Language>('en');
  const [userName, setUserName] = useState('');
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [powerSaving, setPowerSaving] = useState(false);
  const [autoDetect, setAutoDetect] = useState(true);
  const [permission, setPermission] = useState<PermissionState>('none');
  const [trips, setTrips] = useState<Trip[]>([]);
  const [activeTrip, setActiveTrip] = useState<ActiveTrip | null>(null);
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');

  const t = translations[language];
  const tRef = useRef(t);
  tRef.current = t;
  const nameRef = useRef(userName);
  nameRef.current = userName;
  const tripsRef = useRef(trips);
  tripsRef.current = trips;

  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = useCallback((message: string, ms = 4000) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), ms);
  }, []);

  const reloadTrips = useCallback(async () => {
    const list = await loadTrips();
    setTrips(list);
    return list;
  }, []);

  // ── Initial load ────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const [lang, name, photo, power, auto] = await Promise.all([
          AsyncStorage.getItem(KEYS.language),
          AsyncStorage.getItem(KEYS.userName),
          AsyncStorage.getItem(KEYS.profilePhoto),
          AsyncStorage.getItem(KEYS.powerSaving),
          AsyncStorage.getItem(KEYS.autoDetect),
        ]);
        setLanguage(lang && lang in translations ? (lang as Language) : getDeviceLanguage());
        setUserName(name ?? '');
        setProfilePhoto(photo || null);
        setPowerSaving(power === 'true');
        setAutoDetect(auto !== 'false');
        setPermission(await getPermissionState());
        await finalizeIfStale();
        setActiveTrip(await getActiveTrip());
        await reloadTrips();
      } catch (e: any) {
        console.warn('[DriveIQ] load error', e?.message);
      } finally {
        setIsLoaded(true);
      }
    })();
  }, [reloadTrips]);

  // ── App foreground / background ─────────────────────────
  useEffect(() => {
    const sub = AppState.addEventListener('change', async (s) => {
      setAppActive(s === 'active');
      if (s === 'active') {
        setPermission(await getPermissionState());
        await finalizeIfStale();
        setActiveTrip(await getActiveTrip());
        await reloadTrips();
      }
    });
    return () => sub.remove();
  }, [reloadTrips]);

  // ── Engine events → UI ──────────────────────────────────
  useEffect(() => {
    return subscribe(async (e) => {
      const tt = tRef.current;
      const name = nameRef.current;
      switch (e.type) {
        case 'sample':
          setCurrentSpeed(e.speed);
          setActiveTrip(e.active ? { ...e.active } : null);
          break;
        case 'started':
          setActiveTrip({ ...e.trip });
          showToast(fill(tt.msg_start, { NAME: name }));
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          break;
        case 'brake':
          showToast(tt.msg_brake);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
          break;
        case 'speeding':
          showToast(tt.msg_speed);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
          break;
        case 'finished': {
          setActiveTrip(null);
          if (!e.trip) {
            if (e.reason === 'manual') showToast(tt.msg_too_short);
            break;
          }
          const before = computeAchievements(tripsRef.current, tt);
          const after = computeAchievements(await reloadTrips(), tt);
          const vars = { NAME: name, SCORE: e.trip.score };
          const key = e.trip.score >= 80 ? 'msg_score_great' : e.trip.score >= 50 ? 'msg_score_good' : 'msg_score_bad';
          let message = fill(tt[key], vars);
          after
            .filter((a, i) => a.unlocked && !before[i].unlocked)
            .forEach((a) => (message += '\n' + fill(tt.msg_achievement, { ACH: a.title })));
          showToast(message, 7000);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          break;
        }
      }
    });
  }, [showToast, reloadTrips]);

  // ── Location service lifecycle ──────────────────────────
  // Runs whenever auto-detect is on or a manual trip is active. If the
  // background service cannot start, falls back to a foreground watcher.
  const serviceKey = useRef<string | null>(null);
  const [serviceFailed, setServiceFailed] = useState(false);
  const wantTracking = isLoaded && permission !== 'none' && (autoDetect || activeTrip !== null);
  const hasActiveTrip = activeTrip !== null;

  useEffect(() => {
    if (!isLoaded) return;
    let cancelled = false;
    (async () => {
      if (!wantTracking) {
        serviceKey.current = null;
        await stopService();
        return;
      }
      if (!appActive) return; // can only (re)start from the foreground
      const key = `${powerSaving}|${language}`;
      if (serviceKey.current === key && (await isServiceRunning())) return;
      const ok = await startService({
        powerSaving,
        notificationTitle: 'DriveIQ',
        notificationBody: hasActiveTrip ? t.statusRecording : t.statusReady,
      });
      if (cancelled) return;
      serviceKey.current = ok ? key : null;
      setServiceFailed(!ok);
    })();
    return () => {
      cancelled = true;
    };
  }, [isLoaded, wantTracking, appActive, powerSaving, language, hasActiveTrip, t]);

  useEffect(() => {
    if (!wantTracking || !serviceFailed || !appActive) return;
    let sub: Location.LocationSubscription | null = null;
    Location.watchPositionAsync(
      {
        accuracy: powerSaving ? Location.Accuracy.Balanced : Location.Accuracy.BestForNavigation,
        timeInterval: 1000,
        distanceInterval: 0,
      },
      (loc) => processLocations([loc])
    )
      .then((s) => (sub = s))
      .catch(() => {});
    return () => sub?.remove();
  }, [wantTracking, serviceFailed, appActive, powerSaving]);

  // ── Actions ─────────────────────────────────────────────
  const askPermission = useCallback(async () => {
    const p = await requestPermissions();
    setPermission(p);
    return p;
  }, []);

  const startTrip = useCallback(async () => {
    let p = permission;
    if (p === 'none') p = await askPermission();
    if (p === 'none') {
      showToast(tRef.current.msg_perm_denied, 6000);
      return;
    }
    setActiveTrip({ ...(await startManualTrip()) });
  }, [permission, askPermission, showToast]);

  const stopTrip = useCallback(async () => {
    await endTrip();
  }, []);

  const saveUserName = useCallback(async (name: string) => {
    const trimmed = name.trim();
    setUserName(trimmed);
    await AsyncStorage.setItem(KEYS.userName, trimmed);
  }, []);

  const saveLanguage = useCallback(async (lang: Language) => {
    setLanguage(lang);
    await AsyncStorage.setItem(KEYS.language, lang);
  }, []);

  const saveProfilePhoto = useCallback(async (uri: string) => {
    // Picker results live in a cache folder; keep a permanent copy.
    let finalUri = uri;
    try {
      const dest = `${FileSystem.documentDirectory}profile_${Date.now()}.jpg`;
      await FileSystem.copyAsync({ from: uri, to: dest });
      finalUri = dest;
    } catch {}
    setProfilePhoto(finalUri);
    await AsyncStorage.setItem(KEYS.profilePhoto, finalUri);
  }, []);

  const savePowerSaving = useCallback(async (on: boolean) => {
    setPowerSaving(on);
    await AsyncStorage.setItem(KEYS.powerSaving, JSON.stringify(on));
  }, []);

  const saveAutoDetect = useCallback(async (on: boolean) => {
    setAutoDetect(on);
    await AsyncStorage.setItem(KEYS.autoDetect, JSON.stringify(on));
  }, []);

  const stats = useMemo<Stats>(() => {
    if (!trips.length) return { totalTrips: 0, totalDistance: 0, avgScore: 0, bestScore: 0 };
    const scores = trips.map((x) => x.score);
    return {
      totalTrips: trips.length,
      totalDistance: parseFloat(trips.reduce((s, x) => s + x.distance, 0).toFixed(1)),
      avgScore: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
      bestScore: Math.max(...scores),
    };
  }, [trips]);

  const value: AppContextValue = {
    isLoaded,
    t,
    language,
    locale: LOCALE_TAG[language],
    userName,
    profilePhoto,
    powerSaving,
    autoDetect,
    permission,
    trips,
    stats,
    activeTrip,
    currentSpeed: activeTrip || wantTracking ? currentSpeed : 0,
    toast,
    showToast,
    saveUserName,
    saveLanguage,
    saveProfilePhoto,
    savePowerSaving,
    saveAutoDetect,
    askPermission,
    startTrip,
    stopTrip,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}

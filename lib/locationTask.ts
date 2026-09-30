// ============================================
// Background location task
// Defined at module scope and imported from /index.js so it exists
// before the app renders, including when the OS wakes the app in the
// background. Every location batch goes to the trip engine.
// ============================================

import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import { Platform } from 'react-native';
import { processLocations } from './tripEngine';

export const LOCATION_TASK_NAME = 'driveiq-location-tracking';

if (!TaskManager.isTaskDefined(LOCATION_TASK_NAME)) {
  TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
    if (error) {
      console.warn('[DriveIQ][BG]', error.message);
      return;
    }
    const locations = (data as { locations?: Location.LocationObject[] } | undefined)?.locations;
    if (locations?.length) await processLocations(locations);
  });
}

export type PermissionState = 'none' | 'foreground' | 'background';

export async function getPermissionState(): Promise<PermissionState> {
  const fg = await Location.getForegroundPermissionsAsync();
  if (fg.status !== 'granted') return 'none';
  const bg = await Location.getBackgroundPermissionsAsync();
  return bg.status === 'granted' ? 'background' : 'foreground';
}

export async function requestPermissions(): Promise<PermissionState> {
  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== 'granted') return 'none';
  try {
    const bg = await Location.requestBackgroundPermissionsAsync();
    return bg.status === 'granted' ? 'background' : 'foreground';
  } catch {
    return 'foreground';
  }
}

export interface ServiceOptions {
  powerSaving: boolean;
  notificationTitle: string;
  notificationBody: string;
}

export async function isServiceRunning(): Promise<boolean> {
  return Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME).catch(() => false);
}

// (Re)starts background location updates. Must be called while the app
// is in the foreground (Android 12+ forbids starting it from background).
export async function startService(opts: ServiceOptions): Promise<boolean> {
  try {
    if (await isServiceRunning()) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
    }
    await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
      accuracy: opts.powerSaving ? Location.Accuracy.Balanced : Location.Accuracy.BestForNavigation,
      timeInterval: opts.powerSaving ? 8000 : 2000,
      // 0 keeps updates coming while parked, which is what ends a trip.
      distanceInterval: 0,
      pausesUpdatesAutomatically: false,
      activityType: Location.ActivityType.AutomotiveNavigation,
      showsBackgroundLocationIndicator: Platform.OS === 'ios',
      foregroundService: {
        notificationTitle: opts.notificationTitle,
        notificationBody: opts.notificationBody,
        notificationColor: '#00AAFF',
        killServiceOnDestroy: false,
      },
    });
    return true;
  } catch (e: any) {
    console.warn('[DriveIQ] startService failed:', e?.message);
    return false;
  }
}

export async function stopService(): Promise<void> {
  try {
    if (await isServiceRunning()) await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
  } catch (e: any) {
    console.warn('[DriveIQ] stopService failed:', e?.message);
  }
}

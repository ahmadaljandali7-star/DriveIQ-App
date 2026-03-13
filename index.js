// CRITICAL: This file MUST be the entry point
// TaskManager.defineTask() must be called at the TOP LEVEL before any component loads

import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';

// ============================================
// TASK DEFINITION - MUST BE AT TOP LEVEL
// ============================================
export const LOCATION_TASK_NAME = 'driveiq-location-tracking';

// Define the background location task BEFORE anything else
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  const timestamp = new Date().toISOString();
  
  if (error) {
    console.error(`[LocationTask] Error at ${timestamp}:`, error.message);
    return;
  }

  if (data) {
    const { locations } = data;
    if (locations && locations.length > 0) {
      const location = locations[locations.length - 1];
      const speedKmh = Math.round((location.coords.speed || 0) * 3.6);
      console.log(`[LocationTask] Location received - Speed: ${speedKmh} km/h, Lat: ${location.coords.latitude.toFixed(5)}, Lng: ${location.coords.longitude.toFixed(5)}`);
    }
  }
});

console.log('[DriveIQ] Background task registered successfully');

// ============================================
// NOW IMPORT EXPO ROUTER
// ============================================
import 'expo-router/entry';

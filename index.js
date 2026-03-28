javascript
// ============================================
// CRITICAL: Entry Point for DriveIQ
// TaskManager.defineTask() MUST be called at TOP LEVEL
// before any component or router loads
// ============================================

import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Task name constant
export const LOCATION_TASK_NAME = 'driveiq-location-tracking';

// Storage key for background data
const BG_LOCATION_KEY = 'driveiq_bg_locations';

// ============================================
// BACKGROUND TASK DEFINITION
// ============================================
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  const timestamp = new Date().toISOString();
  
  if (error) {
    console.error(`[LocationTask] Error at ${timestamp}:`, error.message);
    return TaskManager.TaskResult.CONTINUE;
  }
  
  if (data) {
    const { locations } = data;
    if (locations && locations.length > 0) {
      try {
        // Get the latest location
        const location = locations[locations.length - 1];
        const speedKmh = Math.round((location.coords.speed || 0) * 3.6);
        
        console.log(`[LocationTask] Background update - Speed: ${speedKmh} km/h`);
        
        // Store background location data for the foreground app to use
        const existingData = await AsyncStorage.getItem(BG_LOCATION_KEY);
        const bgLocations = existingData ? JSON.parse(existingData) : [];
        
        bgLocations.push({
          timestamp: timestamp,
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          speed: speedKmh,
          accuracy: location.coords.accuracy
        });
        
        // Keep only last 100 locations to avoid storage overflow
        if (bgLocations.length > 100) {
          bgLocations.shift();
        }
        
        await AsyncStorage.setItem(BG_LOCATION_KEY, JSON.stringify(bgLocations));
      } catch (storageError) {
        console.error('[LocationTask] Storage error:', storageError);
      }
    }
  }
  
  return TaskManager.TaskResult.CONTINUE;
});

console.log('[DriveIQ] ✅ Background location task registered successfully');

// ============================================
// NOW IMPORT AND START EXPO ROUTER
// ============================================
import 'expo-router/entry';
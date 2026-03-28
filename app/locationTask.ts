typescript
// ============================================
// Location Task Helper Module
// The actual task is defined in /index.js (entry point)
// This file exports helpers and the task name
// ============================================

import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';

export const LOCATION_TASK_NAME = 'driveiq-location-tracking';

// Check if the background task is properly set up
export async function checkTaskStatus(): Promise<{
  isDefined: boolean;
  isRegistered: boolean;
}> {
  try {
    const isDefined = TaskManager.isTaskDefined(LOCATION_TASK_NAME);
    const isRegistered = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
    
    console.log(`[TaskHelper] Task "${LOCATION_TASK_NAME}" - Defined: ${isDefined}, Registered: ${isRegistered}`);
    
    return { isDefined, isRegistered };
  } catch (error) {
    console.error('[TaskHelper] Error checking task status:', error);
    return { isDefined: false, isRegistered: false };
  }
}

// Ensure task is ready before starting tracking
export async function ensureTaskReady(): Promise<boolean> {
  const { isDefined } = await checkTaskStatus();
  
  if (!isDefined) {
    console.error('[TaskHelper] CRITICAL: Background task not defined! Check index.js');
    return false;
  }
  
  return true;
}

// Stop the background task if running
export async function stopBackgroundTask(): Promise<void> {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
    if (isRegistered) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
      console.log('[TaskHelper] Background task stopped');
    }
  } catch (error) {
    console.error('[TaskHelper] Error stopping task:', error);
  }
}

// Start the background location task
export async function startBackgroundTask(): Promise<boolean> {
  try {
    const { isDefined } = await checkTaskStatus();
    
    if (!isDefined) {
      console.error('[TaskHelper] Cannot start - task not defined');
      return false;
    }
    
    // Stop any existing task first
    await stopBackgroundTask();
    
    // Start the background location updates
    await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
      accuracy: Location.Accuracy.BestForNavigation,
      timeInterval: 2000,
      distanceInterval: 5,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: 'DriveIQ - تتبع القيادة',
        notificationBody: 'جاري تسجيل رحلتك...',
        notificationColor: '#0066CC',
      },
      pausesUpdatesAutomatically: false,
      activityType: Location.ActivityType.AutomotiveNavigation,
    });
    
    console.log('[TaskHelper] Background task started successfully');
    return true;
  } catch (error) {
    console.error('[TaskHelper] Error starting task:', error);
    return false;
  }
}
// This file only exports the task name and helper functions
// The actual task definition is in /index.js (entry point)

import * as TaskManager from 'expo-task-manager';

export const LOCATION_TASK_NAME = 'driveiq-location-tracking';

// Helper function to check if task is properly set up
export async function checkTaskStatus(): Promise<{ isDefined: boolean; isRegistered: boolean }> {
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

"import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';

export const LOCATION_TASK_NAME = 'driveiq-location-tracking';

// This interface must match the one in index.tsx
interface LocationTaskData {
  locations: Location.LocationObject[];
}

// Define the task ONCE at module level - this is critical!
// This file must be imported at the app entry point
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error('[LocationTask] Error:', error.message);
    return;
  }

  if (data) {
    const { locations } = data as LocationTaskData;
    console.log('[LocationTask] Received locations:', locations.length);
    
    // The actual processing is handled by the component via callback
    // This task just keeps the app alive in background
  }
});

console.log('[LocationTask] Task registered:', LOCATION_TASK_NAME);
"

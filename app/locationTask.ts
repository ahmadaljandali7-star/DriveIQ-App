import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';

export const LOCATION_TASK_NAME = 'driveiq-location-tracking';

// This interface must match the one in index.tsx
interface LocationTaskData {
  locations: Location.LocationObject[];
}

// Define the task ONCE at module level
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  console.log(`[LocationTask] ========== TASK EXECUTED at ${new Date().toISOString()} ==========`);
  
  if (error) {
    console.error('[LocationTask] ❌ Error:', error.message);
    return;
  }

  if (data) {
    const { locations } = data as LocationTaskData;
    console.log(`[LocationTask] ✅ Received ${locations?.length || 0} locations`);
    
    if (locations && locations.length > 0) {
      const lastLocation = locations[locations.length - 1];
      console.log(`[LocationTask] Last location - lat: ${lastLocation.coords.latitude}, lng: ${lastLocation.coords.longitude}, speed: ${lastLocation.coords.speed}`);
    }
  } else {
    console.log('[LocationTask] ⚠️ No data received');
  }
});

console.log('[LocationTask] ✅ Task defined successfully at module level');

// Helper function to check task status
export async function checkTaskStatus() {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
    console.log(`[LocationTask] 📊 Task registered: ${isRegistered}`);
    
    const isDefined = TaskManager.isTaskDefined(LOCATION_TASK_NAME);
    console.log(`[LocationTask] 📊 Task defined: ${isDefined}`);
    
    return { isRegistered, isDefined };
  } catch (error) {
    console.error('[LocationTask] ❌ Error checking task status:', error);
    return { isRegistered: false, isDefined: false };
  }
}

// Function to ensure task is ready
export async function ensureTaskReady() {
  console.log('[LocationTask] 🔍 Ensuring task is ready...');
  const { isRegistered, isDefined } = await checkTaskStatus();
  
  if (!isDefined) {
    console.error('[LocationTask] ❌ CRITICAL: Task not defined!');
    return false;
  }
  
  console.log('[LocationTask] ✅ Task is ready');
  return true;
}

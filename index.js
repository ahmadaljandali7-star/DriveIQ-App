import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';

const LOCATION_TASK_NAME = 'driveiq-location-tracking';

TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  console.log('[LocationTask] Executing task at ' + new Date().toISOString());

  if (error) {
    console.error('[LocationTask] Error:', error.message);
    return;
  }

  if (data) {
    const { locations } = data;
    console.log('[LocationTask] Received ' + (locations ? locations.length : 0) + ' locations');
  }
});

console.log('[LocationTask] Task defined successfully');

export { LOCATION_TASK_NAME };

export async function ensureTaskReady() {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
    console.log('[LocationTask] Registered: ' + isRegistered);
    return isRegistered;
  } catch (error) {
    console.error('[LocationTask] Error checking registration:', error);
    return false;
  }
}

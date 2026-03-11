const startTracking = async () => {
  // ========== DIAGNOSTIC LOGS ==========
  console.log('[TRACKING] 1. ========== START TRACKING ==========');
  console.log('[TRACKING] 2. StartTracking function entered');
  
  // Check task status first
  console.log('[TRACKING] 🔍 Checking task status...');
  try {
    const isTaskDefined = TaskManager.isTaskDefined(LOCATION_TASK_NAME);
    console.log(`[TRACKING] 📊 Task defined: ${isTaskDefined}`);
    
    const isTaskRegistered = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
    console.log(`[TRACKING] 📊 Task registered: ${isTaskRegistered}`);
    
    if (!isTaskDefined) {
      console.error('[TRACKING] ❌ CRITICAL: Task not defined!');
      Alert.alert('خطأ', 'لم يتم تهيئة نظام التتبع بشكل صحيح. أعد تشغيل التطبيق.');
      return;
    }
  } catch (taskError) {
    console.error('[TRACKING] ❌ Error checking task:', taskError);
  }
  // ======================================

  // Check foreground permission
  if (!locationPermission) {
    console.log('[TRACKING] 3. FAILED: No foreground permission');
    Alert.alert(
      'صلاحية الموقع مطلوبة',
      'لم يتم تفعيل صلاحية الموقع. الرجاء الذهاب إلى الإعدادات ومنح التطبيق إذن الوصول إلى الموقع.',
      [
        { text: 'إلغاء', style: 'cancel' },
        { text: 'فتح الإعدادات', onPress: () => Linking.openSettings() }
      ]
    );
    return;
  }
  console.log('[TRACKING] 4. Foreground permission OK');

  // Check background permission on Android (warn but don't block)
  if (Platform.OS === 'android' && !backgroundPermission) {
    console.log('[TRACKING] 5. WARNING: No background permission');
    showToast('تحذير: التتبع قد يتوقف عند إغلاق التطبيق. يفضل منح صلاحية الموقع "طوال الوقت".');
  } else {
    console.log('[TRACKING] 6. Background permission OK');
  }

  setIsLoading(true);
  console.log('[TRACKING] 7. isLoading set to true');

  try {
    console.log('[TRACKING] 8. Inside try block');

    // Generate a local trip ID
    const localTripId = 'trip_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
    console.log('[TRACKING] 9. Local trip ID generated:', localTripId);

    // Try to create trip in backend (but don't fail if backend is unavailable)
    let tripId = localTripId;
    let isOffline = true;
    console.log('[TRACKING] 10. Default offline mode set');

    if (API_URL) {
      console.log('[TRACKING] 11. API_URL exists, attempting backend call...');
      try {
        const response = await fetch(`${API_URL}/api/trips`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            device_id: deviceId,
            start_time: new Date().toISOString(),
          }),
        });

        console.log('[TRACKING] 12. Backend response status:', response.status);

        if (response.ok) {
          const trip = await response.json();
          tripId = trip.id;
          isOffline = false;
          console.log('[TRACKING] 13. Backend trip created:', tripId);
        } else {
          const errorText = await response.text();
          console.log('[TRACKING] 14. Backend error:', errorText);
        }
      } catch (apiError) {
        console.log('[TRACKING] 15. Backend call FAILED, using offline mode', apiError);
      }
    } else {
      console.log('[TRACKING] 16. No API_URL, using offline mode');
    }

    // Initialize trip data
    console.log('[TRACKING] 17. Initializing trip data...');
    const tripData: TripData = {
      id: tripId,
      startTime: new Date(),
      distance: 0,
      maxSpeed: 0,
      avgSpeed: 0,
      hardBrakes: 0,
      hardAccelerations: 0,
      speedingCount: 0,
      speedReadings: [],
      isOffline: isOffline,
    };
    
    setCurrentTrip(tripData);
    tripDataRef.current = tripData;
    console.log('[TRACKING] 18. Trip data initialized and set', { tripId, isOffline });

    // Start location tracking
    console.log('[TRACKING] 19. Starting location updates...');

    // First, try to start background location tracking with foreground service
    let backgroundStarted = false;
    console.log('[TRACKING] 20. Attempting background location...');

    if (Platform.OS === 'android') {
      try {
        // Check if task is already running
        const isTaskRunning = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
        console.log('[TRACKING] 21. Task already running:', isTaskRunning);

        if (isTaskRunning) {
          // Stop existing task first
          console.log('[TRACKING] 22. Stopping existing task...');
          await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
        }

        console.log('[TRACKING] 23. Starting background location with foreground service...');
        await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 1000,
          distanceInterval: 1,
          showsBackgroundLocationIndicator: true,
          foregroundService: {
            notificationTitle: 'DriveIQ',
            notificationBody: 'يتم تسجيل رحلتك حالياً...',
            notificationColor: '#0066CC',
          },
        });

        backgroundStarted = true;
        console.log('[TRACKING] 24. ✅ Background location started successfully!');
      } catch (bgError: any) {
        console.log('[TRACKING] 25. ❌ Background location FAILED:', bgError.message);
        showToast('تحذير: لا يمكن تشغيل التتبع في الخلفية');
      }
    } else {
      console.log('[TRACKING] 26. Not Android, skipping background task');
    }

    // Always start foreground watcher for UI updates
    console.log('[TRACKING] 27. Attempting foreground watcher...');
    try {
      locationSubscription.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 1000,
          distanceInterval: 1,
        },
        (location) => {
          handleLocationUpdate(location);
        }
      );
      console.log('[TRACKING] 28. ✅ Foreground watcher started successfully!');
    } catch (fgError: any) {
      console.log('[TRACKING] 29. ❌ Foreground watcher FAILED:', fgError.message);
      throw new Error(`فشل بدء تتبع الموقع: ${fgError.message}`);
    }

    // Update state
    setIsTracking(true);
    console.log('[TRACKING] 30. isTracking set to true');

    // Show success message in Arabic
    console.log('[TRACKING] 31. ✅ SUCCESS: Tracking started!');
    Alert.alert(
      'انطلاقة آمنة! 🚗',
      `دعنا نلتقط رحلتك. شد حزام الأمان!\n\n${isOffline ? '(وضع غير متصل)' : ''}`,
      [{ text: 'حسناً', onPress: () => {} }]
    );

  } catch (error: any) {
    console.log('[TRACKING] 32. ❌ ERROR: Entered catch block');
    console.log('[TRACKING] 33. Error details:', error.message);

    // Clean up any partial state
    if (locationSubscription.current) {
      locationSubscription.current.remove();
      locationSubscription.current = null;
    }

    try {
      const isTaskRunning = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
      if (isTaskRunning) {
        await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
      }
    } catch (cleanupError) {
      console.log('[TRACKING] 34. Cleanup error', cleanupError);
    }

    Alert.alert(
      'خطأ في بدء التتبع',
      `${error.message}\n\nتأكد من:\n1. تفعيل GPS\n2. منح صلاحية الموقع`,
      [{ text: 'حسناً' }]
    );
  } finally {
    console.log('[TRACKING] 35. Entered finally block');
    setIsLoading(false);
    console.log('[TRACKING] 36. isLoading set to false');
  }
};

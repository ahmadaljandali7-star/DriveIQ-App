import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
  ActivityIndicator,
  ToastAndroid,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Import the task definition - MUST be imported to register the task
import { LOCATION_TASK_NAME } from '../locationTask';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';
const WELCOME_SHOWN_KEY = 'driveiq_welcome_shown';
const TRIPS_STORAGE_KEY = 'driveiq_offline_trips';

interface TripData {
  id: string;
  startTime: Date;
  distance: number;
  maxSpeed: number;
  avgSpeed: number;
  hardBrakes: number;
  hardAccelerations: number;
  speedingCount: number;
  speedReadings: number[];
  isOffline: boolean;
}

// Helper function for logging
const log = (tag: string, message: string, data?: any) => {
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
  if (data) {
    console.log(`[${timestamp}][${tag}] ${message}`, data);
  } else {
    console.log(`[${timestamp}][${tag}] ${message}`);
  }
};

export default function TodayScreen() {
  const [isTracking, setIsTracking] = useState(false);
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [currentTrip, setCurrentTrip] = useState<TripData | null>(null);
  const [todayScore, setTodayScore] = useState<number | null>(null);
  const [deviceId, setDeviceId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [locationPermission, setLocationPermission] = useState(false);
  const [backgroundPermission, setBackgroundPermission] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string>('');
  
  const locationSubscription = useRef<Location.LocationSubscription | null>(null);
  const previousSpeed = useRef<number>(0);
  const previousLocation = useRef<Location.LocationObject | null>(null);
  const tripDataRef = useRef<TripData | null>(null);

  // Initialize device ID and show welcome message
  useEffect(() => {
    initializeDevice();
    showWelcomeMessage();
    checkTaskRegistration();
  }, []);

  // Check if task is registered
  const checkTaskRegistration = async () => {
    try {
      const isRegistered = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
      log('Init', `Task "${LOCATION_TASK_NAME}" registered: ${isRegistered}`);
      setDebugInfo(prev => prev + `\nTask registered: ${isRegistered}`);
    } catch (error) {
      log('Init', 'Error checking task registration', error);
    }
  };

  // Show welcome message only once
  const showWelcomeMessage = async () => {
    try {
      const welcomeShown = await AsyncStorage.getItem(WELCOME_SHOWN_KEY);
      if (!welcomeShown) {
        Alert.alert(
          'مرحباً بك في DriveIQ! 🚗',
          'هذا التطبيق يساعدك على تحسين قيادتك. اضغط على "بدء التتبع" قبل الانطلاق.',
          [{ text: 'فهمت', onPress: () => {} }]
        );
        await AsyncStorage.setItem(WELCOME_SHOWN_KEY, 'true');
      }
    } catch (error) {
      log('Welcome', 'Error showing welcome message', error);
    }
  };

  // Show toast for Android
  const showToast = (message: string) => {
    if (Platform.OS === 'android') {
      ToastAndroid.show(message, ToastAndroid.LONG);
    }
  };

  const initializeDevice = async () => {
    log('Init', 'Starting device initialization...');
    log('Init', `API_URL: "${API_URL}"`);
    
    try {
      let id = await AsyncStorage.getItem('deviceId');
      if (!id) {
        id = 'device_' + Math.random().toString(36).substring(2, 15);
        await AsyncStorage.setItem('deviceId', id);
        log('Init', 'Created new device ID:', id);
      } else {
        log('Init', 'Loaded existing device ID:', id);
      }
      setDeviceId(id);
      
      // Request foreground location permission
      log('Permissions', 'Requesting foreground permission...');
      const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
      log('Permissions', `Foreground permission: ${foregroundStatus}`);
      setLocationPermission(foregroundStatus === 'granted');
      
      if (foregroundStatus !== 'granted') {
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
      
      // Request background location permission for Android
      if (Platform.OS === 'android') {
        log('Permissions', 'Requesting background permission...');
        const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
        log('Permissions', `Background permission: ${backgroundStatus}`);
        setBackgroundPermission(backgroundStatus === 'granted');
        setDebugInfo(`FG: ${foregroundStatus}, BG: ${backgroundStatus}`);
      } else {
        setBackgroundPermission(true);
      }
      
      // Fetch today's score (only if API is available)
      if (API_URL) {
        fetchTodayScore(id);
      }
    } catch (error) {
      log('Init', 'Error initializing device', error);
    }
  };

  const fetchTodayScore = async (id: string) => {
    if (!API_URL) {
      log('Score', 'Skipping score fetch - no API URL');
      return;
    }
    
    try {
      log('Score', `Fetching score for device: ${id}`);
      const response = await fetch(`${API_URL}/api/trips/device/${id}`);
      if (response.ok) {
        const trips = await response.json();
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayTrips = trips.filter((trip: any) => {
          const tripDate = new Date(trip.start_time);
          return tripDate >= today;
        });
        
        if (todayTrips.length > 0) {
          const avgScore = todayTrips.reduce((sum: number, t: any) => sum + t.score, 0) / todayTrips.length;
          setTodayScore(Math.round(avgScore));
        } else {
          setTodayScore(null);
        }
      }
    } catch (error) {
      log('Score', 'Error fetching today score', error);
    }
  };

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

  const handleLocationUpdate = useCallback((location: Location.LocationObject) => {
    const tripData = tripDataRef.current;
    if (!tripData) {
      log('Location', 'No trip data, ignoring update');
      return;
    }
    
    const speedKmh = (location.coords.speed || 0) * 3.6;
    const speed = Math.max(0, Math.round(speedKmh));
    
    setCurrentSpeed(speed);
    
    // Calculate distance from previous location
    if (previousLocation.current) {
      const dist = calculateDistance(
        previousLocation.current.coords.latitude,
        previousLocation.current.coords.longitude,
        location.coords.latitude,
        location.coords.longitude
      );
      tripData.distance += dist;
    }
    previousLocation.current = location;
    
    // Update max speed
    if (speed > tripData.maxSpeed) {
      tripData.maxSpeed = speed;
    }
    
    // Track speed readings for average
    tripData.speedReadings.push(speed);
    
    // Detect hard braking (speed decrease > 15 km/h per second)
    const speedDiff = previousSpeed.current - speed;
    if (speedDiff > 15 && previousSpeed.current > 20) {
      tripData.hardBrakes++;
      log('Event', `Hard brake detected! Speed diff: ${speedDiff}`);
      showToast('⚠️ تنبيه: فرملة مفاجئة! خفف السرعة قليلاً وحاول التوقف بهدوء.');
    }
    
    // Detect hard acceleration (speed increase > 15 km/h per second)
    const speedIncrease = speed - previousSpeed.current;
    if (speedIncrease > 15) {
      tripData.hardAccelerations++;
      log('Event', `Hard acceleration detected! Speed increase: ${speedIncrease}`);
    }
    
    // Detect speeding (> 130 km/h)
    if (speed > 130 && previousSpeed.current <= 130) {
      tripData.speedingCount++;
      log('Event', `Speeding detected! Speed: ${speed}`);
      showToast('⚠️ تنبيه: تجاوزت السرعة المسموحة! خفف السرعة.');
    }
    
    previousSpeed.current = speed;
    tripDataRef.current = tripData;
    setCurrentTrip({ ...tripData });
  }, []);

  const stopTracking = async () => {
    log('Tracking', '========== STOP TRACKING ==========');
    
    const tripData = tripDataRef.current;
    if (!tripData) {
      log('Tracking', 'No trip data to save');
      return;
    }
    
    setIsLoading(true);
    try {
      // Stop foreground location tracking
      if (locationSubscription.current) {
        log('Tracking', 'Stopping foreground watcher...');
        locationSubscription.current.remove();
        locationSubscription.current = null;
      }

      // Stop background location tracking
      try {
        const isTaskRunning = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
        if (isTaskRunning) {
          log('Tracking', 'Stopping background task...');
          await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
        }
      } catch (stopError) {
        log('Tracking', 'Error stopping background task', stopError);
      }

      // Calculate final stats
      const endTime = new Date();
      const durationMs = endTime.getTime() - tripData.startTime.getTime();
      const durationMinutes = durationMs / 60000;
      
      const avgSpeed = tripData.speedReadings.length > 0
        ? tripData.speedReadings.reduce((a, b) => a + b, 0) / tripData.speedReadings.length
        : 0;
      
      // Calculate score
      let score = 100;
      score -= tripData.hardBrakes * 4;
      score -= tripData.hardAccelerations * 4;
      score -= tripData.speedingCount * 8;
      score = Math.max(0, Math.round(score));

      log('Tracking', 'Trip summary:', {
        distance: tripData.distance.toFixed(2),
        duration: durationMinutes.toFixed(1),
        maxSpeed: tripData.maxSpeed,
        avgSpeed: avgSpeed.toFixed(1),
        hardBrakes: tripData.hardBrakes,
        hardAccelerations: tripData.hardAccelerations,
        score,
      });

      // Try to save to backend
      if (API_URL && !tripData.isOffline) {
        try {
          const response = await fetch(`${API_URL}/api/trips/${tripData.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              end_time: endTime.toISOString(),
              distance_km: parseFloat(tripData.distance.toFixed(2)),
              duration_minutes: parseFloat(durationMinutes.toFixed(2)),
              max_speed: tripData.maxSpeed,
              avg_speed: parseFloat(avgSpeed.toFixed(1)),
              hard_brakes: tripData.hardBrakes,
              hard_accelerations: tripData.hardAccelerations,
              speeding_count: tripData.speedingCount,
              score: score,
            }),
          });

          if (response.ok) {
            log('Tracking', 'Trip saved to backend');
          } else {
            log('Tracking', 'Failed to save to backend, saving locally');
            await saveOfflineTrip(tripData, score, durationMinutes, avgSpeed);
          }
        } catch (saveError) {
          log('Tracking', 'Backend save error, saving locally', saveError);
          await saveOfflineTrip(tripData, score, durationMinutes, avgSpeed);
        }
      } else {
        // Save offline
        await saveOfflineTrip(tripData, score, durationMinutes, avgSpeed);
      }

      // Show Arabic feedback message based on score
      let feedbackTitle = '';
      let feedbackMessage = '';
      
      if (score > 80) {
        feedbackTitle = 'قيادة ممتازة! 🌟';
        feedbackMessage = `أنت سائق مسؤول. استمر على هذا المنوال!\n\nالنقاط: ${score}\nالمسافة: ${tripData.distance.toFixed(2)} كم\nالمدة: ${durationMinutes.toFixed(1)} دقيقة`;
      } else if (score >= 50) {
        feedbackTitle = 'قيادة جيدة 👍';
        feedbackMessage = `ولكن هناك مجال للتحسن. انتبه للفرامل المفاجئة.\n\nالنقاط: ${score}\nالمسافة: ${tripData.distance.toFixed(2)} كم\nالمدة: ${durationMinutes.toFixed(1)} دقيقة`;
      } else {
        feedbackTitle = 'تنبيه! ⚠️';
        feedbackMessage = `قيادتك تحتاج إلى تحسين كبير. حاول القيادة بهدوء أكبر والتزم بالسرعة المحددة.\n\nالنقاط: ${score}\nالمسافة: ${tripData.distance.toFixed(2)} كم\nالمدة: ${durationMinutes.toFixed(1)} دقيقة`;
      }

      Alert.alert(feedbackTitle, feedbackMessage, [{ text: 'حسناً' }]);

      // Reset state
      setCurrentTrip(null);
      tripDataRef.current = null;
      setCurrentSpeed(0);
      setIsTracking(false);
      previousSpeed.current = 0;
      previousLocation.current = null;
      
      // Refresh today's score
      if (API_URL) {
        fetchTodayScore(deviceId);
      }
      
    } catch (error: any) {
      log('Tracking', 'Error stopping tracking', error);
      Alert.alert('خطأ', 'فشل حفظ الرحلة. يرجى المحاولة مرة أخرى.');
    } finally {
      setIsLoading(false);
    }
  };

  // Save trip data locally when offline
  const saveOfflineTrip = async (tripData: TripData, score: number, duration: number, avgSpeed: number) => {
    try {
      const existingTrips = await AsyncStorage.getItem(TRIPS_STORAGE_KEY);
      const trips = existingTrips ? JSON.parse(existingTrips) : [];
      
      trips.push({
        id: tripData.id,
        start_time: tripData.startTime.toISOString(),
        end_time: new Date().toISOString(),
        distance_km: parseFloat(tripData.distance.toFixed(2)),
        duration_minutes: parseFloat(duration.toFixed(2)),
        max_speed: tripData.maxSpeed,
        avg_speed: parseFloat(avgSpeed.toFixed(1)),
        hard_brakes: tripData.hardBrakes,
        hard_accelerations: tripData.hardAccelerations,
        speeding_count: tripData.speedingCount,
        score: score,
        synced: false,
      });
      
      await AsyncStorage.setItem(TRIPS_STORAGE_KEY, JSON.stringify(trips));
      log('Tracking', 'Trip saved locally');
    } catch (error) {
      log('Tracking', 'Error saving offline trip', error);
    }
  };

  // Haversine formula to calculate distance between two coordinates
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const getScoreColor = (score: number | null) => {
    if (score === null) return '#6B7280';
    if (score >= 80) return '#10B981';
    if (score >= 60) return '#F59E0B';
    return '#EF4444';
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>DriveIQ</Text>
        <Text style={styles.headerSubtitle}>Smart Driving Analytics</Text>
      </View>

      <View style={styles.content}>
        {/* Today's Score Card */}
        <View style={styles.scoreCard}>
          <Text style={styles.scoreLabel}>Today's Score</Text>
          <Text style={[styles.scoreValue, { color: getScoreColor(todayScore) }]}>
            {todayScore !== null ? todayScore : '--'}
          </Text>
          <Text style={styles.scoreSubtext}>
            {todayScore !== null ? 'Based on today\'s trips' : 'No trips recorded today'}
          </Text>
        </View>

        {/* Speed Display */}
        <View style={styles.speedCard}>
          <View style={styles.speedIconContainer}>
            <Ionicons name="speedometer" size={32} color="#0066CC" />
          </View>
          <View style={styles.speedInfo}>
            <Text style={styles.speedValue}>{currentSpeed}</Text>
            <Text style={styles.speedUnit}>km/h</Text>
          </View>
          <Text style={styles.speedLabel}>
            {isTracking ? 'Current Speed' : 'Speed'}
          </Text>
        </View>

        {/* Trip Stats (shown during tracking) */}
        {isTracking && currentTrip && (
          <View style={styles.tripStats}>
            <View style={styles.statItem}>
              <Ionicons name="navigate" size={20} color="#0066CC" />
              <Text style={styles.statValue}>{currentTrip.distance.toFixed(2)}</Text>
              <Text style={styles.statLabel}>km</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Ionicons name="flash" size={20} color="#F59E0B" />
              <Text style={styles.statValue}>{currentTrip.maxSpeed}</Text>
              <Text style={styles.statLabel}>max km/h</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Ionicons name="warning" size={20} color="#EF4444" />
              <Text style={styles.statValue}>{currentTrip.hardBrakes + currentTrip.hardAccelerations}</Text>
              <Text style={styles.statLabel}>events</Text>
            </View>
          </View>
        )}

        {/* Tracking Status */}
        <View style={styles.statusContainer}>
          <View style={[styles.statusIndicator, { backgroundColor: isTracking ? '#10B981' : '#6B7280' }]} />
          <Text style={styles.statusText}>
            {isTracking ? 'Recording trip...' : 'Not tracking'}
          </Text>
        </View>

        {/* Debug Info (can be removed in production) */}
        {debugInfo ? (
          <Text style={styles.debugText}>{debugInfo}</Text>
        ) : null}

        {/* Control Buttons */}
        <View style={styles.buttonContainer}>
          {!isTracking ? (
            <TouchableOpacity
              style={[styles.button, styles.startButton]}
              onPress={startTracking}
              disabled={isLoading}
              activeOpacity={0.8}
            >
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <Ionicons name="play" size={24} color="#FFFFFF" />
                  <Text style={styles.buttonText}>Start Tracking</Text>
                </>
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.button, styles.stopButton]}
              onPress={stopTracking}
              disabled={isLoading}
              activeOpacity={0.8}
            >
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <Ionicons name="stop" size={24} color="#FFFFFF" />
                  <Text style={styles.buttonText}>Stop Tracking</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A1628',
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  scoreCard: {
    backgroundColor: '#0F1F38',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#1E3A5F',
  },
  scoreLabel: {
    fontSize: 16,
    color: '#9CA3AF',
    marginBottom: 8,
  },
  scoreValue: {
    fontSize: 72,
    fontWeight: 'bold',
  },
  scoreSubtext: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  speedCard: {
    backgroundColor: '#0F1F38',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#1E3A5F',
  },
  speedIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(0, 102, 204, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  speedInfo: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  speedValue: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  speedUnit: {
    fontSize: 20,
    color: '#9CA3AF',
    marginLeft: 8,
  },
  speedLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  tripStats: {
    flexDirection: 'row',
    backgroundColor: '#0F1F38',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#1E3A5F',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#1E3A5F',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  statusIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  statusText: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  debugText: {
    fontSize: 10,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 12,
  },
  buttonContainer: {
    marginTop: 'auto',
    marginBottom: Platform.OS === 'ios' ? 20 : 10,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    borderRadius: 16,
    gap: 12,
  },
  startButton: {
    backgroundColor: '#0066CC',
  },
  stopButton: {
    backgroundColor: '#DC2626',
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

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

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';
const LOCATION_TASK_NAME = 'driveiq-location-tracking';
const WELCOME_SHOWN_KEY = 'driveiq_welcome_shown';

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
}

// Global variables to share data with TaskManager
let globalTripData: TripData | null = null;
let globalPreviousSpeed = 0;
let globalPreviousLocation: Location.LocationObject | null = null;
let onHardBrakeCallback: (() => void) | null = null;
let onLocationUpdateCallback: ((location: Location.LocationObject) => void) | null = null;

// Define the background location task
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error('Location task error:', error);
    return;
  }
  
  if (data) {
    const { locations } = data as { locations: Location.LocationObject[] };
    if (locations && locations.length > 0) {
      const location = locations[0];
      
      // Process location update
      if (globalTripData && onLocationUpdateCallback) {
        onLocationUpdateCallback(location);
      }
    }
  }
});

export default function TodayScreen() {
  const [isTracking, setIsTracking] = useState(false);
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [currentTrip, setCurrentTrip] = useState<TripData | null>(null);
  const [todayScore, setTodayScore] = useState<number | null>(null);
  const [deviceId, setDeviceId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [locationPermission, setLocationPermission] = useState(false);
  const [backgroundPermission, setBackgroundPermission] = useState(false);
  
  const locationSubscription = useRef<Location.LocationSubscription | null>(null);
  const previousSpeed = useRef<number>(0);
  const previousLocation = useRef<Location.LocationObject | null>(null);

  // Initialize device ID and show welcome message
  useEffect(() => {
    initializeDevice();
    showWelcomeMessage();
  }, []);

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
      console.error('Error showing welcome message:', error);
    }
  };

  // Show toast for Android
  const showToast = (message: string) => {
    if (Platform.OS === 'android') {
      ToastAndroid.show(message, ToastAndroid.LONG);
    }
  };

  const initializeDevice = async () => {
    try {
      let id = await AsyncStorage.getItem('deviceId');
      if (!id) {
        id = 'device_' + Math.random().toString(36).substring(2, 15);
        await AsyncStorage.setItem('deviceId', id);
      }
      setDeviceId(id);
      
      // Request foreground location permission
      const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
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
        const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
        setBackgroundPermission(backgroundStatus === 'granted');
      } else {
        setBackgroundPermission(true);
      }
      
      // Fetch today's score
      fetchTodayScore(id);
    } catch (error) {
      console.error('Error initializing device:', error);
    }
  };

  const fetchTodayScore = async (id: string) => {
    try {
      const response = await fetch(`${API_URL}/api/trips/device/${id}`);
      if (response.ok) {
        const trips = await response.json();
        // Get today's trips
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
      console.error('Error fetching today score:', error);
    }
  };

  const startTracking = async () => {
    // Check foreground permission
    if (!locationPermission) {
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

    // Check background permission on Android
    if (Platform.OS === 'android' && !backgroundPermission) {
      Alert.alert(
        'صلاحية الموقع في الخلفية مطلوبة',
        'للتتبع المستمر، يرجى منح صلاحية الموقع "طوال الوقت" من الإعدادات.',
        [
          { text: 'إلغاء', style: 'cancel' },
          { text: 'فتح الإعدادات', onPress: () => Linking.openSettings() }
        ]
      );
      return;
    }

    setIsLoading(true);
    try {
      // Create trip in backend
      const response = await fetch(`${API_URL}/api/trips`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          device_id: deviceId,
          start_time: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create trip');
      }

      const trip = await response.json();
      
      // Initialize trip data
      const tripData: TripData = {
        id: trip.id,
        startTime: new Date(),
        distance: 0,
        maxSpeed: 0,
        avgSpeed: 0,
        hardBrakes: 0,
        hardAccelerations: 0,
        speedingCount: 0,
        speedReadings: [],
      };
      setCurrentTrip(tripData);
      globalTripData = tripData;
      
      // Set up location update callback
      onLocationUpdateCallback = (location: Location.LocationObject) => {
        handleLocationUpdate(location, tripData);
      };

      // Start background location tracking with foreground service
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

      // Also start foreground watcher for UI updates
      locationSubscription.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 1000,
          distanceInterval: 1,
        },
        (location) => handleLocationUpdate(location, tripData)
      );

      setIsTracking(true);
      previousSpeed.current = 0;
      previousLocation.current = null;
      globalPreviousSpeed = 0;
      globalPreviousLocation = null;

      // Show success message in Arabic
      Alert.alert(
        'انطلاقة آمنة! 🚗',
        'دعنا نلتقط رحلتك. شد حزام الأمان!',
        [{ text: 'حسناً', onPress: () => {} }]
      );
      
    } catch (error) {
      console.error('Error starting tracking:', error);
      Alert.alert(
        'خطأ',
        'فشل بدء التتبع. يرجى المحاولة مرة أخرى.',
        [{ text: 'حسناً' }]
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleLocationUpdate = useCallback((location: Location.LocationObject, tripData: TripData) => {
    const speedKmh = (location.coords.speed || 0) * 3.6; // Convert m/s to km/h
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
    globalPreviousLocation = location;
    
    // Update max speed
    if (speed > tripData.maxSpeed) {
      tripData.maxSpeed = speed;
    }
    
    // Track speed readings for average
    tripData.speedReadings.push(speed);
    
    // Detect hard braking (speed decrease > 15 km/h per second)
    const speedDiff = previousSpeed.current - speed;
    if (speedDiff > 15) {
      tripData.hardBrakes++;
      // Show toast warning for hard braking in Arabic
      showToast('⚠️ تنبيه: فرملة مفاجئة! خفف السرعة قليلاً وحاول التوقف بهدوء.');
    }
    
    // Detect hard acceleration (speed increase > 15 km/h per second)
    const speedIncrease = speed - previousSpeed.current;
    if (speedIncrease > 15) {
      tripData.hardAccelerations++;
    }
    
    // Detect speeding (> 130 km/h)
    if (speed > 130 && previousSpeed.current <= 130) {
      tripData.speedingCount++;
      showToast('⚠️ تنبيه: تجاوزت السرعة المسموحة! خفف السرعة.');
    }
    
    previousSpeed.current = speed;
    globalPreviousSpeed = speed;
    setCurrentTrip({ ...tripData });
    globalTripData = tripData;
  }, []);

  const stopTracking = async () => {
    if (!currentTrip) return;
    
    setIsLoading(true);
    try {
      // Stop foreground location tracking
      if (locationSubscription.current) {
        locationSubscription.current.remove();
        locationSubscription.current = null;
      }

      // Stop background location tracking
      const isTaskRunning = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
      if (isTaskRunning) {
        await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
      }

      // Clear global references
      globalTripData = null;
      onLocationUpdateCallback = null;

      // Calculate final stats
      const endTime = new Date();
      const durationMs = endTime.getTime() - currentTrip.startTime.getTime();
      const durationMinutes = durationMs / 60000;
      
      const avgSpeed = currentTrip.speedReadings.length > 0
        ? currentTrip.speedReadings.reduce((a, b) => a + b, 0) / currentTrip.speedReadings.length
        : 0;
      
      // Calculate score
      let score = 100;
      score -= currentTrip.hardBrakes * 4;
      score -= currentTrip.hardAccelerations * 4;
      score -= currentTrip.speedingCount * 8;
      score = Math.max(0, score);

      // Update trip in backend
      const response = await fetch(`${API_URL}/api/trips/${currentTrip.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          end_time: endTime.toISOString(),
          distance_km: parseFloat(currentTrip.distance.toFixed(2)),
          duration_minutes: parseFloat(durationMinutes.toFixed(2)),
          max_speed: currentTrip.maxSpeed,
          avg_speed: parseFloat(avgSpeed.toFixed(1)),
          hard_brakes: currentTrip.hardBrakes,
          hard_accelerations: currentTrip.hardAccelerations,
          speeding_count: currentTrip.speedingCount,
          score: score,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save trip');
      }

      // Show Arabic feedback message based on score
      let feedbackTitle = '';
      let feedbackMessage = '';
      
      if (score > 80) {
        feedbackTitle = 'قيادة ممتازة! 🌟';
        feedbackMessage = `أنت سائق مسؤول. استمر على هذا المنوال!\n\nالنقاط: ${score}\nالمسافة: ${currentTrip.distance.toFixed(2)} كم\nالمدة: ${durationMinutes.toFixed(1)} دقيقة`;
      } else if (score >= 50) {
        feedbackTitle = 'قيادة جيدة 👍';
        feedbackMessage = `ولكن هناك مجال للتحسن. انتبه للفرامل المفاجئة.\n\nالنقاط: ${score}\nالمسافة: ${currentTrip.distance.toFixed(2)} كم\nالمدة: ${durationMinutes.toFixed(1)} دقيقة`;
      } else {
        feedbackTitle = 'تنبيه! ⚠️';
        feedbackMessage = `قيادتك تحتاج إلى تحسين كبير. حاول القيادة بهدوء أكبر والتزم بالسرعة المحددة.\n\nالنقاط: ${score}\nالمسافة: ${currentTrip.distance.toFixed(2)} كم\nالمدة: ${durationMinutes.toFixed(1)} دقيقة`;
      }

      Alert.alert(feedbackTitle, feedbackMessage, [{ text: 'حسناً' }]);

      // Reset state
      setCurrentTrip(null);
      setCurrentSpeed(0);
      setIsTracking(false);
      previousSpeed.current = 0;
      previousLocation.current = null;
      
      // Refresh today's score
      fetchTodayScore(deviceId);
      
    } catch (error) {
      console.error('Error stopping tracking:', error);
      Alert.alert('خطأ', 'فشل حفظ الرحلة. يرجى المحاولة مرة أخرى.');
    } finally {
      setIsLoading(false);
    }
  };

  // Haversine formula to calculate distance between two coordinates
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Earth's radius in km
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
    marginBottom: 24,
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

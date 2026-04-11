3. ملف app/(tabs)/index.tsx
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
  ScrollView,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';

import { LOCATION_TASK_NAME, checkTaskStatus } from '../locationTask';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
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

// Animated components
const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

// Speed Gauge Component
const SpeedGauge = ({ speed, maxSpeed = 200 }: { speed: number; maxSpeed?: number }) => {
  const size = 180;
  const strokeWidth = 12;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const percentage = Math.min(speed / maxSpeed, 1);
  const strokeDashoffset = circumference - (percentage * circumference * 0.75);
  
  const getSpeedColor = () => {
    if (speed > 130) return '#EF4444';
    if (speed > 100) return '#F59E0B';
    return '#10B981';
  };

  return (
    <View style={styles.gaugeContainer}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Defs>
          <SvgGradient id="speedGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor="#10B981" />
            <Stop offset="50%" stopColor="#F59E0B" />
            <Stop offset="100%" stopColor="#EF4444" />
          </SvgGradient>
        </Defs>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#1E3A5F"
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={`${circumference * 0.75} ${circumference}`}
          strokeLinecap="round"
          rotation={135}
          origin={`${size / 2}, ${size / 2}`}
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={getSpeedColor()}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          rotation={135}
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <View style={styles.gaugeTextContainer}>
        <Text style={styles.gaugeSpeed}>{speed}</Text>
        <Text style={styles.gaugeUnit}>km/h</Text>
      </View>
    </View>
  );
};

// Confetti particle component
const ConfettiParticle = ({ index }: { index: number }) => {
  const translateY = useSharedValue(-50);
  const translateX = useSharedValue(0);
  const opacity = useSharedValue(1);
  const rotate = useSharedValue(0);
  
  useEffect(() => {
    const delay = index * 50;
    const randomX = (Math.random() - 0.5) * SCREEN_WIDTH;
    setTimeout(() => {
      translateY.value = withTiming(400, { duration: 2000 });
      translateX.value = withTiming(randomX, { duration: 2000 });
      rotate.value = withTiming(360 * 3, { duration: 2000 });
      opacity.value = withTiming(0, { duration: 2000 });
    }, delay);
  }, []);
  
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { translateX: translateX.value },
      { rotate: `${rotate.value}deg` },
    ],
    opacity: opacity.value,
  }));
  
  const colors = ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4'];
  const color = colors[Math.floor(Math.random() * colors.length)];
  
  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          width: 10,
          height: 10,
          backgroundColor: color,
          borderRadius: 2,
        },
        animatedStyle,
      ]}
    />
  );
};

// Log helper
const log = (tag: string, message: string, data?: any) => {
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
  if (data) {
    console.log(`[${timestamp}][${tag}] ${message}`, JSON.stringify(data));
  } else {
    console.log(`[${timestamp}][${tag}] ${message}`);
  }
};

// Toast helper
const showToast = (message: string) => {
  if (Platform.OS === 'android') {
    ToastAndroid.show(message, ToastAndroid.LONG);
  }
};

export default function TodayScreen() {
  const [isTracking, setIsTracking] = useState(false);
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [currentTrip, setCurrentTrip] = useState<TripData | null>(null);
  const [todayScore, setTodayScore] = useState<number | null>(null);
  const [deviceId, setDeviceId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [locationPermission, setLocationPermission] = useState(false);
  const [backgroundPermission, setBackgroundPermission] = useState(false);
  const [taskReady, setTaskReady] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  const locationSubscription = useRef<Location.LocationSubscription | null>(null);
  const previousSpeed = useRef(0);
  const previousLocation = useRef<Location.LocationObject | null>(null);
  const tripDataRef = useRef<TripData | null>(null);

  // Animations
  const pulseScale = useSharedValue(1);
  const buttonScale = useSharedValue(1);
  const cardOpacity = useSharedValue(0);
  const cardTranslateY = useSharedValue(20);

  // Initialize animations on mount
  useEffect(() => {
    cardOpacity.value = withTiming(1, { duration: 600 });
    cardTranslateY.value = withSpring(0, { damping: 15 });
    
    initializeApp();
  }, []);

  // Pulse animation for tracking
  useEffect(() => {
    if (isTracking) {
      pulseScale.value = withRepeat(
        withSequence(
          withTiming(1.05, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );
    } else {
      pulseScale.value = withTiming(1);
    }
  }, [isTracking]);

  const cardAnimatedStyle = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
    transform: [{ translateY: cardTranslateY.value }],
  }));

  const pulseAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  const buttonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  const initializeApp = async () => {
    log('Init', 'Starting app initialization...');
    
    const status = await checkTaskStatus();
    setTaskReady(status.isDefined);
    
    if (!status.isDefined) {
      log('Init', 'WARNING: Background task not defined!');
    }
    
    await initializeDevice();
    await showWelcomeMessage();
    await loadTodayScore();
  };

  const showWelcomeMessage = async () => {
    try {
      const welcomeShown = await AsyncStorage.getItem(WELCOME_SHOWN_KEY);
      if (!welcomeShown) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(
          'مرحباً بك في DriveIQ! 🚗',
          'هذا التطبيق يساعدك على تحسين قيادتك وتتبع رحلاتك.\n\nاضغط على "بدء التتبع" قبل الانطلاق.',
          [{ text: 'فهمت', onPress: () => {} }]
        );
        await AsyncStorage.setItem(WELCOME_SHOWN_KEY, 'true');
      }
    } catch (error) {
      log('Welcome', 'Error showing welcome message');
    }
  };

  const initializeDevice = async () => {
    try {
      let id = await AsyncStorage.getItem('deviceId');
      if (!id) {
        id = 'device_' + Math.random().toString(36).substring(2, 15);
        await AsyncStorage.setItem('deviceId', id);
        log('Init', 'Created new device ID: ' + id);
      }
      setDeviceId(id);

      log('Permissions', 'Requesting foreground permission...');
      const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
      log('Permissions', 'Foreground permission: ' + foregroundStatus);
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

      if (Platform.OS === 'android') {
        log('Permissions', 'Requesting background permission...');
        const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
        log('Permissions', 'Background permission: ' + backgroundStatus);
        setBackgroundPermission(backgroundStatus === 'granted');

        if (backgroundStatus !== 'granted') {
          showToast('للحصول على تتبع مستمر، اختر "طوال الوقت" في إعدادات الموقع');
        }
      } else {
        setBackgroundPermission(true);
      }
    } catch (error) {
      log('Init', 'Error initializing device');
    }
  };

  const loadTodayScore = async () => {
    try {
      const tripsData = await AsyncStorage.getItem(TRIPS_STORAGE_KEY);
      if (tripsData) {
        const trips = JSON.parse(tripsData);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const todayTrips = trips.filter((trip: any) => {
          const tripDate = new Date(trip.start_time);
          return tripDate >= today;
        });

        if (todayTrips.length > 0) {
          const avgScore = todayTrips.reduce((sum: number, t: any) => sum + t.score, 0) / todayTrips.length;
          setTodayScore(Math.round(avgScore));
        }
      }
    } catch (error) {
      log('Score', 'Error loading today score');
    }
  };

  const startTracking = async () => {
    log('Tracking', '========== START TRACKING ==========');
    
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    buttonScale.value = withSequence(
      withTiming(0.95, { duration: 100 }),
      withTiming(1, { duration: 100 })
    );

    if (!locationPermission) {
      Alert.alert(
        'صلاحية الموقع مطلوبة',
        'لم يتم تفعيل صلاحية الموقع.',
        [
          { text: 'إلغاء', style: 'cancel' },
          { text: 'فتح الإعدادات', onPress: () => Linking.openSettings() }
        ]
      );
      return;
    }

    const status = await checkTaskStatus();
    if (!status.isDefined) {
      log('Tracking', 'CRITICAL: Background task not defined!');
      Alert.alert(
        'خطأ في النظام',
        'نظام التتبع غير جاهز. أعد تشغيل التطبيق.',
        [{ text: 'حسناً' }]
      );
      return;
    }

    if (Platform.OS === 'android' && !backgroundPermission) {
      showToast('تحذير: التتبع قد يتوقف عند إغلاق التطبيق');
    }

    setIsLoading(true);

    try {
      const tripId = 'trip_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);

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
        isOffline: true,
      };

      setCurrentTrip(tripData);
      tripDataRef.current = tripData;

      try {
        const isRunning = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
        if (isRunning) {
          log('Tracking', 'Stopping existing background task...');
          await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
        }
      } catch (e) {
        // Ignore
      }

      if (Platform.OS === 'android') {
        try {
          log('Tracking', 'Starting background location with foreground service...');

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

          log('Tracking', '✅ Background location started successfully');
        } catch (bgError: any) {
          log('Tracking', '⚠️ Background location failed: ' + bgError.message);
        }
      }

      log('Tracking', 'Starting foreground location watcher...');
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

      log('Tracking', '✅ Foreground watcher started');
      setIsTracking(true);

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      Alert.alert(
        'انطلاقة آمنة! 🚗',
        'دعنا نلتقط رحلتك. شد حزام الأمان!',
        [{ text: 'حسناً' }]
      );

    } catch (error: any) {
      log('Tracking', '❌ Error: ' + error.message);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

      if (locationSubscription.current) {
        locationSubscription.current.remove();
        locationSubscription.current = null;
      }

      Alert.alert(
        'خطأ في بدء التتبع',
        `${error.message}\n\nتأكد من:\n1. تفعيل GPS\n2. منح صلاحية الموقع`,
        [{ text: 'حسناً' }]
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleLocationUpdate = useCallback((location: Location.LocationObject) => {
    const tripData = tripDataRef.current;
    if (!tripData) return;

    const speedKmh = (location.coords.speed || 0) * 3.6;
    const speed = Math.max(0, Math.round(speedKmh));

    setCurrentSpeed(speed);

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

    if (speed > tripData.maxSpeed) {
      tripData.maxSpeed = speed;
    }

    tripData.speedReadings.push(speed);

    const speedDiff = previousSpeed.current - speed;
    if (speedDiff > 15 && previousSpeed.current > 20) {
      tripData.hardBrakes++;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      showToast('⚠️ فرملة مفاجئة!');
    }

    const speedIncrease = speed - previousSpeed.current;
    if (speedIncrease > 15) {
      tripData.hardAccelerations++;
    }

    if (speed > 130 && previousSpeed.current <= 130) {
      tripData.speedingCount++;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      showToast('⚠️ تجاوزت السرعة المسموحة!');
    }

    previousSpeed.current = speed;
    tripDataRef.current = tripData;
    setCurrentTrip({ ...tripData });
  }, []);

  const stopTracking = async () => {
    log('Tracking', '========== STOP TRACKING ==========');

    buttonScale.value = withSequence(
      withTiming(0.95, { duration: 100 }),
      withTiming(1, { duration: 100 })
    );
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    const tripData = tripDataRef.current;
    if (!tripData) {
      log('Tracking', 'No trip data to save');
      return;
    }

    setIsLoading(true);

    try {
      if (locationSubscription.current) {
        locationSubscription.current.remove();
        locationSubscription.current = null;
      }

      try {
        const isRunning = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
        if (isRunning) {
          await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
        }
      } catch (e) {
        // Ignore
      }

      const endTime = new Date();
      const durationMs = endTime.getTime() - tripData.startTime.getTime();
      const durationMinutes = durationMs / 60000;

      const avgSpeed = tripData.speedReadings.length > 0
        ? tripData.speedReadings.reduce((a, b) => a + b, 0) / tripData.speedReadings.length
        : 0;

      let score = 100;
      score -= tripData.hardBrakes * 4;
      score -= tripData.hardAccelerations * 4;
      score -= tripData.speedingCount * 8;
      score = Math.max(0, Math.round(score));

      log('Tracking', 'Trip summary', {
        distance: tripData.distance.toFixed(2),
        duration: durationMinutes.toFixed(1),
        maxSpeed: tripData.maxSpeed,
        score,
      });

      await saveOfflineTrip(tripData, score, durationMinutes, avgSpeed);

      if (score === 100) {
        setShowConfetti(true);
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setTimeout(() => setShowConfetti(false), 3000);
      }

      let feedbackTitle = '';
      let feedbackMessage = '';

      if (score >= 90) {
        feedbackTitle = '🌟 قيادة مثالية!';
        feedbackMessage = `أنت سائق محترف!\n\n🏆 النقاط: ${score}/100\n📏 المسافة: ${tripData.distance.toFixed(2)} كم\n⏱️ المدة: ${durationMinutes.toFixed(1)} دقيقة`;
      } else if (score >= 70) {
        feedbackTitle = '👍 قيادة جيدة جداً';
        feedbackMessage = `أداء ممتاز!\n\n✅ النقاط: ${score}/100\n📏 المسافة: ${tripData.distance.toFixed(2)} كم\n⏱️ المدة: ${durationMinutes.toFixed(1)} دقيقة`;
      } else if (score >= 50) {
        feedbackTitle = '💪 يمكنك التحسن';
        feedbackMessage = `هناك مجال للتحسن.\n\n📊 النقاط: ${score}/100\n📏 المسافة: ${tripData.distance.toFixed(2)} كم\n⏱️ المدة: ${durationMinutes.toFixed(1)} دقيقة`;
      } else {
        feedbackTitle = '⚠️ قيادة تحتاج انتباه';
        feedbackMessage = `حاول القيادة بهدوء أكبر.\n\n⚠️ النقاط: ${score}/100\n📏 المسافة: ${tripData.distance.toFixed(2)} كم\n⏱️ المدة: ${durationMinutes.toFixed(1)} دقيقة`;
      }

      Alert.alert(feedbackTitle, feedbackMessage, [{ text: 'حسناً' }]);

      setCurrentTrip(null);
      tripDataRef.current = null;
      setCurrentSpeed(0);
      setIsTracking(false);
      previousSpeed.current = 0;
      previousLocation.current = null;

      await loadTodayScore();

    } catch (error: any) {
      log('Tracking', 'Error stopping: ' + error.message);
      Alert.alert('خطأ', 'فشل حفظ الرحلة.');
    } finally {
      setIsLoading(false);
    }
  };

  const saveOfflineTrip = async (tripData: TripData, score: number, duration: number, avgSpeed: number) => {
    try {
      const existingTrips = await AsyncStorage.getItem(TRIPS_STORAGE_KEY);
      const trips = existingTrips ? JSON.parse(existingTrips) : [];

      trips.unshift({
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
        score,
        synced: false,
      });

      await AsyncStorage.setItem(TRIPS_STORAGE_KEY, JSON.stringify(trips));
      log('Tracking', 'Trip saved locally');
    } catch (error) {
      log('Tracking', 'Error saving offline trip');
    }
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const getScoreColor = (score: number | null) => {
    if (score === null) return '#6B7280';
    if (score >= 80) return '#10B981';
    if (score >= 60) return '#F59E0B';
    return '#EF4444';
  };

  return (
    <LinearGradient
      colors={['#0A1628', '#0F2847', '#0A1628']}
      style={styles.container}
    >
      <SafeAreaView style={styles.container} edges={['top']}>
        {showConfetti && (
          <View style={styles.confettiContainer}>
            {[...Array(30)].map((_, i) => (
              <ConfettiParticle key={i} index={i} />
            ))}
          </View>
        )}

        <View style={styles.header}>
          <Text style={styles.headerTitle}>DriveIQ</Text>
          <Text style={styles.headerSubtitle}>تحليل القيادة الذكي</Text>
        </View>

        <ScrollView 
          style={styles.content}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <Animated.View style={[styles.scoreCard, cardAnimatedStyle]}>
            <LinearGradient
              colors={['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.05)']}
              style={styles.glassCard}
            >
              <Text style={styles.scoreLabel}>نقاط اليوم</Text>
              <Text style={[styles.scoreValue, { color: getScoreColor(todayScore) }]}>
                {todayScore !== null ? todayScore : '--'}
              </Text>
              <Text style={styles.scoreSubtext}>
                {todayScore !== null ? 'بناءً على رحلات اليوم' : 'لم تسجل رحلات اليوم'}
              </Text>
            </LinearGradient>
          </Animated.View>

          <Animated.View style={[styles.speedCard, pulseAnimatedStyle]}>
            <SpeedGauge speed={currentSpeed} />
            <Text style={styles.speedLabel}>
              {isTracking ? 'السرعة الحالية' : 'السرعة'}
            </Text>
          </Animated.View>

          {isTracking && currentTrip && (
            <Animated.View style={[styles.tripStats, cardAnimatedStyle]}>
              <View style={styles.statItem}>
                <Ionicons name="navigate" size={20} color="#00AAFF" />
                <Text style={styles.statValue}>{currentTrip.distance.toFixed(2)}</Text>
                <Text style={styles.statLabel}>كم</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Ionicons name="speedometer" size={20} color="#F59E0B" />
                <Text style={styles.statValue}>{currentTrip.maxSpeed}</Text>
                <Text style={styles.statLabel}>أقصى سرعة</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Ionicons name="warning" size={20} color="#EF4444" />
                <Text style={styles.statValue}>
                  {currentTrip.hardBrakes + currentTrip.hardAccelerations}
                </Text>
                <Text style={styles.statLabel}>أحداث</Text>
              </View>
            </Animated.View>
          )}

          <View style={styles.statusContainer}>
            <Animated.View 
              style={[
                styles.statusIndicator,
                { backgroundColor: isTracking ? '#10B981' : '#6B7280' },
                isTracking && pulseAnimatedStyle
              ]}
            />
            <Text style={styles.statusText}>
              {isTracking ? 'جاري تسجيل الرحلة...' : 'غير نشط'}
            </Text>
          </View>
        </ScrollView>

        <View style={styles.buttonContainer}>
          {!isTracking ? (
            <AnimatedTouchable
              style={[styles.button, styles.startButton, buttonAnimatedStyle]}
              onPress={startTracking}
              disabled={isLoading}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#0088FF', '#0066CC']}
                style={styles.buttonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                {isLoading ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <>
                    <Ionicons name="play-circle" size={28} color="#FFFFFF" />
                    <Text style={styles.buttonText}>بدء التتبع</Text>
                  </>
                )}
              </LinearGradient>
            </AnimatedTouchable>
          ) : (
            <AnimatedTouchable
              style={[styles.button, styles.stopButton, buttonAnimatedStyle]}
              onPress={stopTracking}
              disabled={isLoading}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#EF4444', '#DC2626']}
                style={styles.buttonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                {isLoading ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <>
                    <Ionicons name="stop-circle" size={28} color="#FFFFFF" />
                    <Text style={styles.buttonText}>إيقاف التتبع</Text>
                  </>
                )}
              </LinearGradient>
            </AnimatedTouchable>
          )}
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  confettiContainer: { ...StyleSheet.absoluteFillObject, alignItems: 'center', zIndex: 100 },
  header: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 8, alignItems: 'flex-start' },
  headerTitle: { fontSize: 36, fontWeight: 'bold', color: '#FFFFFF', letterSpacing: 1 },
  headerSubtitle: { fontSize: 14, color: '#6B7280', marginTop: 4 },
  content: { flex: 1, paddingHorizontal: 24 },
  scrollContent: { paddingTop: 16, paddingBottom: 100 },
  scoreCard: { marginBottom: 20, borderRadius: 24, overflow: 'hidden' },
  glassCard: { padding: 24, alignItems: 'center', borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  scoreLabel: { fontSize: 16, color: '#9CA3AF', marginBottom: 8 },
  scoreValue: { fontSize: 72, fontWeight: 'bold' },
  scoreSubtext: { fontSize: 12, color: '#6B7280', marginTop: 8 },
  speedCard: { backgroundColor: 'rgba(15, 31, 56, 0.8)', borderRadius: 24, padding: 24, alignItems: 'center', marginBottom: 20, borderWidth: 1, borderColor: '#1E3A5F' },
  gaugeContainer: { position: 'relative', alignItems: 'center', justifyContent: 'center' },
  gaugeTextContainer: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  gaugeSpeed: { fontSize: 48, fontWeight: 'bold', color: '#FFFFFF' },
  gaugeUnit: { fontSize: 16, color: '#9CA3AF', marginTop: -4 },
  speedLabel: { fontSize: 14, color: '#6B7280', marginTop: 12 },
  tripStats: { flexDirection: 'row', backgroundColor: 'rgba(15, 31, 56, 0.8)', borderRadius: 20, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: '#1E3A5F', justifyContent: 'space-around', alignItems: 'center' },
  statItem: { alignItems: 'center', flex: 1 },
  statValue: { fontSize: 24, fontWeight: 'bold', color: '#FFFFFF', marginTop: 8 },
  statLabel: { fontSize: 12, color: '#6B7280', marginTop: 4 },
  statDivider: { width: 1, height: 50, backgroundColor: '#1E3A5F' },
  statusContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  statusIndicator: { width: 12, height: 12, borderRadius: 6, marginRight: 8 },
  statusText: { fontSize: 14, color: '#9CA3AF' },
  buttonContainer: { paddingHorizontal: 24, paddingBottom: Platform.OS === 'ios' ? 100 : 90 },
  button: { borderRadius: 20, overflow: 'hidden', elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
  buttonGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 18, gap: 12 },
  startButton: {},
  stopButton: {},
  buttonText: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
});

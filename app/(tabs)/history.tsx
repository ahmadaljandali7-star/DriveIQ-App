import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Share,
  Dimensions,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
  Extrapolate,
  runOnJS,
} from 'react-native-reanimated';
import {
  Gesture,
  GestureDetector,
} from 'react-native-gesture-handler';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const TRIPS_STORAGE_KEY = 'driveiq_offline_trips';

interface Trip {
  id: string;
  start_time: string;
  end_time: string;
  distance_km: number;
  duration_minutes: number;
  max_speed: number;
  avg_speed: number;
  hard_brakes: number;
  hard_accelerations: number;
  speeding_count: number;
  score: number;
}

// Swipeable Trip Card Component
const SwipeableTripCard = ({ 
  item, 
  index, 
  onShare 
}: { 
  item: Trip; 
  index: number; 
  onShare: (trip: Trip) => void;
}) => {
  const translateX = useSharedValue(0);
  const cardOpacity = useSharedValue(0);
  const cardScale = useSharedValue(0.9);

  useEffect(() => {
    const delay = index * 100;
    setTimeout(() => {
      cardOpacity.value = withTiming(1, { duration: 400 });
      cardScale.value = withSpring(1, { damping: 15 });
    }, delay);
  }, []);

  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      if (event.translationX > 0) {
        translateX.value = Math.min(event.translationX, 100);
      }
    })
    .onEnd((event) => {
      if (event.translationX > 80) {
        runOnJS(onShare)(item);
        runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Medium);
      }
      translateX.value = withSpring(0);
    });

  const cardAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { scale: cardScale.value }
    ],
    opacity: cardOpacity.value,
  }));

  const actionAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [0, 60], [0, 1], Extrapolate.CLAMP),
  }));

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'اليوم';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'أمس';
    } else {
      return date.toLocaleDateString('ar-SA', { month: 'short', day: 'numeric' });
    }
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return '#10B981';
    if (score >= 60) return '#F59E0B';
    return '#EF4444';
  };

  const getScoreGrade = (score: number): string => {
    if (score >= 90) return 'ممتاز';
    if (score >= 80) return 'جيد جداً';
    if (score >= 60) return 'جيد';
    return 'يحتاج تحسين';
  };

  const getScoreIcon = (score: number) => {
    if (score >= 90) return 'trophy';
    if (score >= 80) return 'star';
    if (score >= 60) return 'thumbs-up';
    return 'alert-circle';
  };

  return (
    <View style={styles.cardWrapper}>
      <Animated.View style={[styles.shareAction, actionAnimatedStyle]}>
        <Ionicons name="share-social" size={24} color="#FFFFFF" />
        <Text style={styles.shareText}>مشاركة</Text>
      </Animated.View>

      <GestureDetector gesture={panGesture}>
        <Animated.View style={[styles.tripCard, cardAnimatedStyle]}>
          <LinearGradient
            colors={['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.03)']}
            style={styles.tripCardGradient}
          >
            <View style={styles.tripHeader}>
              <View style={styles.tripDateTime}>
                <Text style={styles.tripDate}>{formatDate(item.start_time)}</Text>
                <Text style={styles.tripTime}>{formatTime(item.start_time)}</Text>
              </View>
              <View style={[styles.scoreContainer, { backgroundColor: `${getScoreColor(item.score)}20` }]}>
                <Ionicons name={getScoreIcon(item.score) as any} size={16} color={getScoreColor(item.score)} />
                <Text style={[styles.tripScore, { color: getScoreColor(item.score) }]}>{item.score}</Text>
              </View>
            </View>

            <View style={styles.progressBarContainer}>
              <View style={styles.progressBarBg}>
                <View style={[styles.progressBarFill, { width: `${item.score}%`, backgroundColor: getScoreColor(item.score) }]} />
              </View>
            </View>

            <View style={styles.tripDetails}>
              <View style={styles.tripStat}>
                <Ionicons name="navigate" size={16} color="#00AAFF" />
                <Text style={styles.statValue}>{item.distance_km.toFixed(1)} كم</Text>
              </View>
              <View style={styles.tripStat}>
                <Ionicons name="time" size={16} color="#A855F7" />
                <Text style={styles.statValue}>{item.duration_minutes.toFixed(0)} د</Text>
              </View>
              <View style={styles.tripStat}>
                <Ionicons name="speedometer" size={16} color="#F59E0B" />
                <Text style={styles.statValue}>{item.max_speed} كم/س</Text>
              </View>
            </View>

            <View style={styles.tripFooter}>
              <Text style={[styles.gradeText, { color: getScoreColor(item.score) }]}>{getScoreGrade(item.score)}</Text>
              <View style={styles.eventsContainer}>
                {item.hard_brakes > 0 && (
                  <View style={styles.eventBadge}>
                    <Ionicons name="warning" size={12} color="#EF4444" />
                    <Text style={styles.eventText}>{item.hard_brakes}</Text>
                  </View>
                )}
                {item.speeding_count > 0 && (
                  <View style={styles.eventBadge}>
                    <Ionicons name="flash" size={12} color="#F59E0B" />
                    <Text style={styles.eventText}>{item.speeding_count}</Text>
                  </View>
                )}
              </View>
            </View>

            <View style={styles.swipeHint}>
              <Ionicons name="chevron-forward" size={14} color="#4B5563" />
              <Text style={styles.swipeHintText}>اسحب للمشاركة</Text>
            </View>
          </LinearGradient>
        </Animated.View>
      </GestureDetector>
    </View>
  );
};

export default function HistoryScreen() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [totalStats, setTotalStats] = useState({ totalTrips: 0, totalDistance: 0, avgScore: 0 });

  useEffect(() => {
    fetchTrips();
  }, []);

  const fetchTrips = async () => {
    try {
      const tripsData = await AsyncStorage.getItem(TRIPS_STORAGE_KEY);
      if (tripsData) {
        const parsedTrips = JSON.parse(tripsData);
        setTrips(parsedTrips);
        
        if (parsedTrips.length > 0) {
          const totalDistance = parsedTrips.reduce((sum: number, t: Trip) => sum + t.distance_km, 0);
          const avgScore = parsedTrips.reduce((sum: number, t: Trip) => sum + t.score, 0) / parsedTrips.length;
          setTotalStats({ totalTrips: parsedTrips.length, totalDistance, avgScore: Math.round(avgScore) });
        }
      }
    } catch (error) {
      console.error('Error fetching trips:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await fetchTrips();
    setRefreshing(false);
  }, []);

  const shareTrip = async (trip: Trip) => {
    try {
      const message = `🚗 رحلتي مع DriveIQ\n\n🏆 النقاط: ${trip.score}/100\n📏 المسافة: ${trip.distance_km.toFixed(1)} كم\n⏱️ المدة: ${trip.duration_minutes.toFixed(0)} دقيقة\n🚀 أقصى سرعة: ${trip.max_speed} كم/س\n\nحمّل DriveIQ وحسّن قيادتك!`;
      await Share.share({ message, title: 'مشاركة الرحلة' });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const clearHistory = () => {
    Alert.alert('مسح السجل', 'هل أنت متأكد من حذف جميع الرحلات؟', [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'حذف',
        style: 'destructive',
        onPress: async () => {
          await AsyncStorage.removeItem(TRIPS_STORAGE_KEY);
          setTrips([]);
          setTotalStats({ totalTrips: 0, totalDistance: 0, avgScore: 0 });
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        },
      },
    ]);
  };

  const renderTripItem = ({ item, index }: { item: Trip; index: number }) => (
    <SwipeableTripCard item={item} index={index} onShare={shareTrip} />
  );

  const renderEmptyList = () => (
    <View style={styles.emptyContainer}>
      <LinearGradient colors={['rgba(0, 102, 204, 0.1)', 'rgba(0, 102, 204, 0.05)']} style={styles.emptyIconContainer}>
        <Ionicons name="car-sport" size={60} color="#0066CC" />
      </LinearGradient>
      <Text style={styles.emptyTitle}>لا توجد رحلات بعد</Text>
      <Text style={styles.emptyText}>ابدأ تتبع رحلتك الأولى لرؤية سجل القيادة هنا</Text>
    </View>
  );

  const renderHeader = () => {
    if (trips.length === 0) return null;
    
    return (
      <View style={styles.statsHeader}>
        <LinearGradient colors={['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.03)']} style={styles.statsCard}>
          <View style={styles.statBox}>
            <Text style={styles.statBoxValue}>{totalStats.totalTrips}</Text>
            <Text style={styles.statBoxLabel}>رحلة</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statBoxValue}>{totalStats.totalDistance.toFixed(1)}</Text>
            <Text style={styles.statBoxLabel}>كم إجمالي</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statBoxValue}>{totalStats.avgScore}</Text>
            <Text style={styles.statBoxLabel}>متوسط النقاط</Text>
          </View>
        </LinearGradient>

        <TouchableOpacity style={styles.clearButton} onPress={clearHistory}>
          <Ionicons name="trash-outline" size={18} color="#EF4444" />
          <Text style={styles.clearButtonText}>مسح السجل</Text>
        </TouchableOpacity>
      </View>
    );
  };

  if (loading) {
    return (
      <LinearGradient colors={['#0A1628', '#0F2847', '#0A1628']} style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#00AAFF" />
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#0A1628', '#0F2847', '#0A1628']} style={styles.container}>
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>السجل</Text>
          <Text style={styles.headerSubtitle}>{trips.length > 0 ? `${trips.length} رحلة مسجلة` : 'رحلاتك ستظهر هنا'}</Text>
        </View>

        <FlatList
          data={trips}
          renderItem={renderTripItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={trips.length === 0 ? styles.emptyListContent : styles.listContent}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={renderEmptyList}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00AAFF" colors={['#00AAFF']} />}
          showsVerticalScrollIndicator={false}
        />
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 16, alignItems: 'flex-start' },
  headerTitle: { fontSize: 36, fontWeight: 'bold', color: '#FFFFFF' },
  headerSubtitle: { fontSize: 14, color: '#6B7280', marginTop: 4 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  statsHeader: { marginBottom: 20 },
  statsCard: { flexDirection: 'row', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', justifyContent: 'space-around' },
  statBox: { alignItems: 'center', flex: 1 },
  statBoxValue: { fontSize: 24, fontWeight: 'bold', color: '#FFFFFF' },
  statBoxLabel: { fontSize: 12, color: '#6B7280', marginTop: 4 },
  statDivider: { width: 1, height: 40, backgroundColor: '#1E3A5F' },
  clearButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 16, padding: 12, borderRadius: 12, backgroundColor: 'rgba(239, 68, 68, 0.1)', gap: 8 },
  clearButtonText: { color: '#EF4444', fontSize: 14, fontWeight: '600' },
  listContent: { paddingHorizontal: 24, paddingBottom: 100 },
  emptyListContent: { flex: 1, paddingHorizontal: 24 },
  cardWrapper: { marginBottom: 12, position: 'relative' },
  shareAction: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 80, backgroundColor: '#10B981', borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  shareText: { color: '#FFFFFF', fontSize: 12, marginTop: 4 },
  tripCard: { borderRadius: 16, overflow: 'hidden' },
  tripCardGradient: { padding: 16, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  tripHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  tripDateTime: { flex: 1 },
  tripDate: { fontSize: 18, fontWeight: '600', color: '#FFFFFF' },
  tripTime: { fontSize: 14, color: '#6B7280', marginTop: 2 },
  scoreContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, gap: 4 },
  tripScore: { fontSize: 20, fontWeight: 'bold' },
  progressBarContainer: { marginBottom: 12 },
  progressBarBg: { height: 4, backgroundColor: '#1E3A5F', borderRadius: 2, overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 2 },
  tripDetails: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#1E3A5F' },
  tripStat: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statValue: { fontSize: 14, color: '#D1D5DB' },
  tripFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  gradeText: { fontSize: 14, fontWeight: '600' },
  eventsContainer: { flexDirection: 'row', gap: 8 },
  eventBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.05)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  eventText: { fontSize: 12, color: '#9CA3AF' },
  swipeHint: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 8, gap: 2 },
  swipeHintText: { fontSize: 10, color: '#4B5563' },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  emptyIconContainer: { width: 120, height: 120, borderRadius: 60, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  emptyTitle: { fontSize: 24, fontWeight: 'bold', color: '#FFFFFF', marginBottom: 8 },
  emptyText: { fontSize: 16, color: '#6B7280', textAlign: 'center', lineHeight: 24 },
});

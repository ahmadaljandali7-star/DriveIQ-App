"import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Switch,
  TouchableOpacity,
  Dimensions,
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
  withSequence,
  Easing,
} from 'react-native-reanimated';

const TRIPS_STORAGE_KEY = 'driveiq_offline_trips';
const DARK_MODE_KEY = 'driveiq_dark_mode';
const USERNAME_KEY = 'driveiq_username';

interface UserStats {
  total_trips: number;
  total_distance: number;
  average_score: number;
  best_score: number;
  total_duration: number;
}

interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  unlocked: boolean;
  progress: number;
  target: number;
}

const SimpleCircle = ({
  progress,
  color = '#00AAFF',
  label,
  value,
  unit,
}: {
  progress: number;
  color?: string;
  label: string;
  value: string | number;
  unit?: string;
}) => {
  var pct = Math.min(Math.max(progress, 0), 1) * 100;
  return (
    <View style={styles.simpleCircleWrap}>
      <View style={styles.simpleCircleOuter}>
        <View style={styles.simpleCircleTrack} />
        <View
          style={[
            styles.simpleCircleFill,
            {
              borderColor: color,
              borderTopColor: pct > 25 ? color : 'transparent',
              borderRightColor: pct > 50 ? color : 'transparent',
              borderBottomColor: pct > 75 ? color : 'transparent',
              borderLeftColor: pct > 0 ? color : 'transparent',
            },
          ]}
        />
        <View style={styles.simpleCircleInner}>
          <Text style={styles.simpleCircleValue}>{value}</Text>
          {unit ? <Text style={styles.simpleCircleUnit}>{unit}</Text> : null}
        </View>
      </View>
      <Text style={styles.simpleCircleLabel}>{label}</Text>
    </View>
  );
};

const AchievementBadge = ({
  achievement,
  index,
}: {
  achievement: Achievement;
  index: number;
}) => {
  const scale = useSharedValue(0);
  const rotation = useSharedValue(0);

  useEffect(() => {
    var delayMs = index * 150;
    setTimeout(() => {
      scale.value = withSpring(1, { damping: 12 });
      if (achievement.unlocked) {
        rotation.value = withSequence(
          withTiming(10, { duration: 100 }),
          withTiming(-10, { duration: 100 }),
          withTiming(0, { duration: 100 })
        );
      }
    }, delayMs);
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { rotate: rotation.value + 'deg' },
    ],
  }));

  var unlockedColors: [string, string] = [
    achievement.color + '30',
    achievement.color + '10',
  ];
  var lockedColors: [string, string] = [
    'rgba(30,58,95,0.5)',
    'rgba(30,58,95,0.3)',
  ];

  return (
    <Animated.View style={[styles.achievementBadge, animatedStyle]}>
      <LinearGradient
        colors={achievement.unlocked ? unlockedColors : lockedColors}
        style={styles.achievementGradient}
      >
        <View
          style={[
            styles.achievementIcon,
            {
              backgroundColor: achievement.unlocked
                ? achievement.color + '20'
                : '#1E3A5F',
            },
          ]}
        >
          <Ionicons
            name={achievement.icon as any}
            size={24}
            color={achievement.unlocked ? achievement.color : '#4B5563'}
          />
        </View>
        <View style={styles.achievementInfo}>
          <Text
            style={[
              styles.achievementTitle,
              { color: achievement.unlocked ? '#FFFFFF' : '#6B7280' },
            ]}
          >
            {achievement.title}
          </Text>
          <Text style={styles.achievementDesc}>{achievement.description}</Text>
          {!achievement.unlocked && (
            <View style={styles.achievementProgress}>
              <View style={styles.achievementProgressBg}>
                <View
                  style={[
                    styles.achievementProgressFill,
                    {
                      width:
                        String(
                          Math.round(
                            (achievement.progress / achievement.target) * 100
                          )
                        ) + '%',
                      backgroundColor: achievement.color,
                    },
                  ]}
                />
              </View>
              <Text style={styles.achievementProgressText}>
                {achievement.progress}/{achievement.target}
              </Text>
            </View>
          )}
        </View>
        {achievement.unlocked && (
          <View style={styles.unlockedBadge}>
            <Ionicons
              name=\"checkmark-circle\"
              size={20}
              color={achievement.color}
            />
          </View>
        )}
      </LinearGradient>
    </Animated.View>
  );
};

function getAvatarColor(name: string): [string, string] {
  var colors: [string, string][] = [
    ['#667eea', '#764ba2'],
    ['#f093fb', '#f5576c'],
    ['#4facfe', '#00f2fe'],
    ['#43e97b', '#38f9d7'],
    ['#fa709a', '#fee140'],
    ['#a8edea', '#fed6e3'],
    ['#ff9a9e', '#fecfef'],
    ['#ffecd2', '#fcb69f'],
  ];

  var hash = 0;
  for (var i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }

  return colors[Math.abs(hash) % colors.length];
}

export default function ProfileScreen() {
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deviceId, setDeviceId] = useState('');
  const [darkMode, setDarkMode] = useState(true);
  const [username, setUsername] = useState('سائق');
  const [achievements, setAchievements] = useState<Achievement[]>([]);

  const avatarScale = useSharedValue(0);
  const statsOpacity = useSharedValue(0);

  useEffect(() => {
    initializeAndFetch();

    setTimeout(() => {
      avatarScale.value = withSpring(1, { damping: 15 });
      statsOpacity.value = withTiming(1, {
        duration: 600,
        easing: Easing.out(Easing.cubic),
      });
    }, 200);
  }, []);

  const avatarAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: avatarScale.value }],
  }));

  const statsAnimatedStyle = useAnimatedStyle(() => ({
    opacity: statsOpacity.value,
  }));

  const initializeAndFetch = async () => {
    try {
      var id = await AsyncStorage.getItem('deviceId');
      if (!id) {
        id = 'device_' + Math.random().toString(36).substring(2, 15);
        await AsyncStorage.setItem('deviceId', id);
      }
      setDeviceId(id);

      var darkModeValue = await AsyncStorage.getItem(DARK_MODE_KEY);
      if (darkModeValue !== null) {
        setDarkMode(darkModeValue === 'true');
      }

      var savedUsername = await AsyncStorage.getItem(USERNAME_KEY);
      if (savedUsername) {
        setUsername(savedUsername);
      }

      await fetchStats();
    } catch (error) {
      console.error('Error initializing:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      var tripsData = await AsyncStorage.getItem(TRIPS_STORAGE_KEY);
      if (tripsData) {
        var trips = JSON.parse(tripsData);

        if (trips.length > 0) {
          var totalDistance = trips.reduce(
            (sum: number, t: any) => sum + (t.distance_km || 0),
            0
          );
          var totalDuration = trips.reduce(
            (sum: number, t: any) => sum + (t.duration_minutes || 0),
            0
          );
          var avgScore =
            trips.reduce((sum: number, t: any) => sum + (t.score || 0), 0) /
            trips.length;
          var bestScore = Math.max(
            ...trips.map((t: any) => t.score || 0)
          );

          setStats({
            total_trips: trips.length,
            total_distance: totalDistance,
            average_score: avgScore,
            best_score: bestScore,
            total_duration: totalDuration,
          });

          updateAchievements(trips.length, totalDistance, bestScore, avgScore);
        } else {
          setStats({
            total_trips: 0,
            total_distance: 0,
            average_score: 0,
            best_score: 0,
            total_duration: 0,
          });
          updateAchievements(0, 0, 0, 0);
        }
      } else {
        updateAchievements(0, 0, 0, 0);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const updateAchievements = (
    trips: number,
    distance: number,
    bestScore: number,
    avgScore: number
  ) => {
    var achievementsList: Achievement[] = [
      {
        id: 'first_trip',
        title: 'الرحلة الأولى',
        description: 'أكمل رحلتك الأولى',
        icon: 'car-sport',
        color: '#10B981',
        unlocked: trips >= 1,
        progress: Math.min(trips, 1),
        target: 1,
      },
      {
        id: 'road_warrior',
        title: 'محارب الطريق',
        description: 'أكمل 10 رحلات',
        icon: 'shield-checkmark',
        color: '#3B82F6',
        unlocked: trips >= 10,
        progress: Math.min(trips, 10),
        target: 10,
      },
      {
        id: 'perfect_driver',
        title: 'سائق مثالي',
        description: 'احصل على 100 نقطة في رحلة',
        icon: 'trophy',
        color: '#F59E0B',
        unlocked: bestScore >= 100,
        progress: bestScore,
        target: 100,
      },
      {
        id: 'long_distance',
        title: 'رحال المسافات',
        description: 'اقطع 50 كم إجمالي',
        icon: 'navigate',
        color: '#8B5CF6',
        unlocked: distance >= 50,
        progress: Math.min(Math.round(distance), 50),
        target: 50,
      },
      {
        id: 'consistent',
        title: 'القيادة المتزنة',
        description: 'حافظ على متوسط 80+ نقطة',
        icon: 'star',
        color: '#EC4899',
        unlocked: avgScore >= 80 && trips >= 5,
        progress: Math.round(avgScore),
        target: 80,
      },
      {
        id: 'century',
        title: 'نادي المئة',
        description: 'أكمل 100 رحلة',
        icon: 'medal',
        color: '#FFD700',
        unlocked: trips >= 100,
        progress: Math.min(trips, 100),
        target: 100,
      },
    ];

    setAchievements(achievementsList);
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await fetchStats();
    setRefreshing(false);
  }, []);

  const toggleDarkMode = async (value: boolean) => {
    setDarkMode(value);
    await AsyncStorage.setItem(DARK_MODE_KEY, value.toString());
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  var getScoreColor = (score: number) => {
    if (score >= 80) return '#10B981';
    if (score >= 60) return '#F59E0B';
    return '#EF4444';
  };

  var getDriverLevel = (avgScore: number, trips: number): string => {
    if (trips === 0) return 'سائق جديد';
    if (avgScore >= 90) return 'سائق محترف';
    if (avgScore >= 80) return 'سائق ماهر';
    if (avgScore >= 60) return 'سائق متوسط';
    return 'سائق مبتدئ';
  };

  var avatarColors = getAvatarColor(username);
  var unlockedCount = achievements.filter((a) => a.unlocked).length;

  var bgColors: [string, string, string] = ['#0A1628', '#0F2847', '#0A1628'];
  var glassColors: [string, string] = [
    'rgba(255,255,255,0.1)',
    'rgba(255,255,255,0.05)',
  ];
  var tipGreenColors: [string, string] = [
    'rgba(16, 185, 129, 0.1)',
    'rgba(16, 185, 129, 0.05)',
  ];
  var tipYellowColors: [string, string] = [
    'rgba(245, 158, 11, 0.1)',
    'rgba(245, 158, 11, 0.05)',
  ];

  if (loading) {
    return (
      <LinearGradient colors={bgColors} style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size=\"large\" color=\"#00AAFF\" />
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={bgColors} style={styles.container}>
      <SafeAreaView style={styles.container} edges={['top']}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor=\"#00AAFF\"
              colors={['#00AAFF']}
            />
          }
        >
          <View style={styles.header}>
            <Text style={styles.headerTitle}>الملف الشخصي</Text>
            <Text style={styles.headerSubtitle}>إحصائيات قيادتك</Text>
          </View>

          <Animated.View
            style={[styles.avatarContainer, avatarAnimatedStyle]}
          >
            <LinearGradient
              colors={avatarColors}
              style={styles.avatar}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Ionicons name=\"person\" size={50} color=\"#FFFFFF\" />
            </LinearGradient>
            <Text style={styles.driverLabel}>
              {stats && stats.average_score > 0
                ? getDriverLevel(stats.average_score, stats.total_trips)
                : 'سائق جديد'}
            </Text>
            <View style={styles.levelBadge}>
              <Ionicons name=\"star\" size={14} color=\"#FFD700\" />
              <Text style={styles.levelText}>
                {'المستوى ' +
                  String(
                    Math.min(
                      Math.floor((stats?.total_trips || 0) / 5) + 1,
                      20
                    )
                  )}
              </Text>
            </View>
          </Animated.View>

          {stats && stats.total_trips > 0 && (
            <Animated.View
              style={[styles.mainScoreCard, statsAnimatedStyle]}
            >
              <LinearGradient
                colors={glassColors}
                style={styles.scoreCardGradient}
              >
                <Text style={styles.mainScoreLabel}>متوسط النقاط</Text>
                <Text
                  style={[
                    styles.mainScoreValue,
                    { color: getScoreColor(stats.average_score) },
                  ]}
                >
                  {stats.average_score.toFixed(0)}
                </Text>
                <View style={styles.scoreBar}>
                  <View
                    style={[
                      styles.scoreBarFill,
                      {
                        width: String(Math.round(stats.average_score)) + '%',
                        backgroundColor: getScoreColor(stats.average_score),
                      },
                    ]}
                  />
                </View>
              </LinearGradient>
            </Animated.View>
          )}

          <Animated.View
            style={[styles.circlesContainer, statsAnimatedStyle]}
          >
            <SimpleCircle
              progress={(stats?.total_trips || 0) / 100}
              color=\"#00AAFF\"
              label=\"الرحلات\"
              value={stats?.total_trips || 0}
            />
            <SimpleCircle
              progress={Math.min((stats?.total_distance || 0) / 500, 1)}
              color=\"#10B981\"
              label=\"المسافة\"
              value={(stats?.total_distance || 0).toFixed(1)}
              unit=\"كم\"
            />
            <SimpleCircle
              progress={(stats?.best_score || 0) / 100}
              color=\"#F59E0B\"
              label=\"أفضل نتيجة\"
              value={stats?.best_score || '--'}
            />
          </Animated.View>

          <View style={styles.achievementsSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>الإنجازات</Text>
              <Text style={styles.achievementCount}>
                {unlockedCount}/{achievements.length}
              </Text>
            </View>
            {achievements.map((achievement, index) => (
              <AchievementBadge
                key={achievement.id}
                achievement={achievement}
                index={index}
              />
            ))}
          </View>

          <View style={styles.settingsSection}>
            <Text style={styles.sectionTitle}>الإعدادات</Text>

            <View style={styles.settingItem}>
              <View style={styles.settingLeft}>
                <View
                  style={[
                    styles.settingIcon,
                    { backgroundColor: 'rgba(139, 92, 246, 0.1)' },
                  ]}
                >
                  <Ionicons name=\"moon\" size={20} color=\"#8B5CF6\" />
                </View>
                <Text style={styles.settingText}>الوضع الليلي</Text>
              </View>
              <Switch
                value={darkMode}
                onValueChange={toggleDarkMode}
                trackColor={{ false: '#1E3A5F', true: '#0066CC' }}
                thumbColor={darkMode ? '#00AAFF' : '#6B7280'}
              />
            </View>
          </View>

          <View style={styles.tipsSection}>
            <Text style={styles.sectionTitle}>نصائح القيادة</Text>

            <LinearGradient colors={tipGreenColors} style={styles.tipCard}>
              <View style={styles.tipIconContainer}>
                <Ionicons name=\"speedometer\" size={24} color=\"#10B981\" />
              </View>
              <View style={styles.tipContent}>
                <Text style={styles.tipTitle}>حافظ على سرعة ثابتة</Text>
                <Text style={styles.tipText}>
                  تجنب التسارع والفرملة المفاجئة لتحسين نقاطك
                </Text>
              </View>
            </LinearGradient>

            <LinearGradient colors={tipYellowColors} style={styles.tipCard}>
              <View style={styles.tipIconContainer}>
                <Ionicons name=\"warning\" size={24} color=\"#F59E0B\" />
              </View>
              <View style={styles.tipContent}>
                <Text style={styles.tipTitle}>التزم بحدود السرعة</Text>
                <Text style={styles.tipText}>
                  تجاوز 130 كم/س يؤثر بشكل كبير على نقاطك
                </Text>
              </View>
            </LinearGradient>
          </View>

          <View style={styles.appInfo}>
            <Text style={styles.appName}>DriveIQ</Text>
            <Text style={styles.appVersion}>الإصدار 1.0.0</Text>
            <Text style={styles.deviceId}>
              {'معرف الجهاز: ' + deviceId.slice(-8)}
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scrollContent: { paddingBottom: 100 },
  header: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 16,
    alignItems: 'flex-start',
  },
  headerTitle: { fontSize: 36, fontWeight: 'bold', color: '#FFFFFF' },
  headerSubtitle: { fontSize: 14, color: '#6B7280', marginTop: 4 },
  avatarContainer: { alignItems: 'center', paddingVertical: 24 },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  driverLabel: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 16,
  },
  levelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginTop: 8,
    gap: 4,
  },
  levelText: { color: '#FFD700', fontSize: 12, fontWeight: '600' },
  mainScoreCard: {
    marginHorizontal: 24,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 24,
  },
  scoreCardGradient: {
    padding: 24,
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  mainScoreLabel: { fontSize: 14, color: '#9CA3AF', marginBottom: 8 },
  mainScoreValue: { fontSize: 64, fontWeight: 'bold' },
  scoreBar: {
    width: '100%',
    height: 8,
    backgroundColor: '#1E3A5F',
    borderRadius: 4,
    marginTop: 16,
    overflow: 'hidden',
  },
  scoreBarFill: { height: '100%', borderRadius: 4 },
  circlesContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 16,
    marginBottom: 32,
  },
  simpleCircleWrap: { alignItems: 'center', width: 100 },
  simpleCircleOuter: {
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  simpleCircleTrack: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 8,
    borderColor: '#1E3A5F',
  },
  simpleCircleFill: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 8,
  },
  simpleCircleInner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  simpleCircleValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  simpleCircleUnit: { fontSize: 10, color: '#9CA3AF', marginTop: -2 },
  simpleCircleLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 8,
    textAlign: 'center',
  },
  achievementsSection: { paddingHorizontal: 24, marginBottom: 32 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', color: '#FFFFFF' },
  achievementCount: { fontSize: 14, color: '#00AAFF', fontWeight: '600' },
  achievementBadge: {
    marginBottom: 12,
    borderRadius: 16,
    overflow: 'hidden',
  },
  achievementGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  achievementIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  achievementInfo: { flex: 1 },
  achievementTitle: { fontSize: 16, fontWeight: '600', marginBottom: 2 },
  achievementDesc: { fontSize: 12, color: '#6B7280' },
  achievementProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 8,
  },
  achievementProgressBg: {
    flex: 1,
    height: 4,
    backgroundColor: '#1E3A5F',
    borderRadius: 2,
    overflow: 'hidden',
  },
  achievementProgressFill: { height: '100%', borderRadius: 2 },
  achievementProgressText: { fontSize: 10, color: '#6B7280' },
  unlockedBadge: { marginLeft: 8 },
  settingsSection: { paddingHorizontal: 24, marginBottom: 32 },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(15, 31, 56, 0.8)',
    padding: 16,
    borderRadius: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#1E3A5F',
  },
  settingLeft: { flexDirection: 'row', alignItems: 'center' },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  settingText: { fontSize: 16, color: '#FFFFFF' },
  tipsSection: { paddingHorizontal: 24, marginBottom: 32 },
  tipCard: {
    flexDirection: 'row',
    borderRadius: 16,
    padding: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  tipIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  tipContent: { flex: 1 },
  tipTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  tipText: { fontSize: 14, color: '#9CA3AF', lineHeight: 20 },
  appInfo: { alignItems: 'center', paddingTop: 16, paddingBottom: 32 },
  appName: { fontSize: 24, fontWeight: 'bold', color: '#00AAFF' },
  appVersion: { fontSize: 14, color: '#6B7280', marginTop: 4 },
  deviceId: { fontSize: 10, color: '#4B5563', marginTop: 8 },
});
"

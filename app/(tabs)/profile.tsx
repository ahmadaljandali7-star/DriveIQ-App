import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

interface UserStats {
  total_trips: number;
  total_distance: number;
  average_score: number;
  best_score: number;
}

export default function ProfileScreen() {
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deviceId, setDeviceId] = useState<string>('');

  useEffect(() => {
    initializeAndFetch();
  }, []);

  const initializeAndFetch = async () => {
    try {
      let id = await AsyncStorage.getItem('deviceId');
      if (!id) {
        id = 'device_' + Math.random().toString(36).substring(2, 15);
        await AsyncStorage.setItem('deviceId', id);
      }
      setDeviceId(id);
      await fetchStats(id);
    } catch (error) {
      console.error('Error initializing:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async (id: string) => {
    try {
      const response = await fetch(`${API_URL}/api/stats/${id}`);
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchStats(deviceId);
    setRefreshing(false);
  }, [deviceId]);

  const getScoreColor = (score: number) => {
    if (score >= 80) return '#10B981';
    if (score >= 60) return '#F59E0B';
    return '#EF4444';
  };

  const getScoreGrade = (score: number) => {
    if (score >= 90) return 'Excellent Driver';
    if (score >= 80) return 'Good Driver';
    if (score >= 60) return 'Average Driver';
    return 'Needs Improvement';
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0066CC" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#0066CC"
            colors={['#0066CC']}
          />
        }
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Profile</Text>
          <Text style={styles.headerSubtitle}>Your driving statistics</Text>
        </View>

        {/* Profile Avatar */}
        <View style={styles.avatarContainer}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={48} color="#0066CC" />
          </View>
          <Text style={styles.driverLabel}>
            {stats && stats.average_score > 0
              ? getScoreGrade(stats.average_score)
              : 'New Driver'}
          </Text>
        </View>

        {/* Main Score Card */}
        {stats && stats.total_trips > 0 && (
          <View style={styles.mainScoreCard}>
            <Text style={styles.mainScoreLabel}>Average Score</Text>
            <Text style={[styles.mainScoreValue, { color: getScoreColor(stats.average_score) }]}>
              {stats.average_score.toFixed(0)}
            </Text>
            <View style={styles.scoreBar}>
              <View
                style={[
                  styles.scoreBarFill,
                  {
                    width: `${stats.average_score}%`,
                    backgroundColor: getScoreColor(stats.average_score),
                  },
                ]}
              />
            </View>
          </View>
        )}

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <View style={[styles.statIconContainer, { backgroundColor: 'rgba(0, 102, 204, 0.1)' }]}>
              <Ionicons name="car" size={24} color="#0066CC" />
            </View>
            <Text style={styles.statValue}>
              {stats ? stats.total_trips : 0}
            </Text>
            <Text style={styles.statLabel}>Total Trips</Text>
          </View>

          <View style={styles.statCard}>
            <View style={[styles.statIconContainer, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}>
              <Ionicons name="navigate" size={24} color="#10B981" />
            </View>
            <Text style={styles.statValue}>
              {stats ? stats.total_distance.toFixed(1) : '0.0'}
            </Text>
            <Text style={styles.statLabel}>Total Distance (km)</Text>
          </View>

          <View style={styles.statCard}>
            <View style={[styles.statIconContainer, { backgroundColor: 'rgba(245, 158, 11, 0.1)' }]}>
              <Ionicons name="trophy" size={24} color="#F59E0B" />
            </View>
            <Text style={styles.statValue}>
              {stats && stats.best_score > 0 ? stats.best_score : '--'}
            </Text>
            <Text style={styles.statLabel}>Best Score</Text>
          </View>

          <View style={styles.statCard}>
            <View style={[styles.statIconContainer, { backgroundColor: 'rgba(139, 92, 246, 0.1)' }]}>
              <Ionicons name="star" size={24} color="#8B5CF6" />
            </View>
            <Text style={styles.statValue}>
              {stats && stats.average_score > 0 ? stats.average_score.toFixed(1) : '--'}
            </Text>
            <Text style={styles.statLabel}>Avg Score</Text>
          </View>
        </View>

        {/* Tips Section */}
        <View style={styles.tipsSection}>
          <Text style={styles.tipsTitle}>Driving Tips</Text>
          <View style={styles.tipCard}>
            <View style={styles.tipIconContainer}>
              <Ionicons name="speedometer" size={20} color="#0066CC" />
            </View>
            <View style={styles.tipContent}>
              <Text style={styles.tipTitle}>Maintain Steady Speed</Text>
              <Text style={styles.tipText}>
                Avoid sudden acceleration and hard braking to improve your score.
              </Text>
            </View>
          </View>
          <View style={styles.tipCard}>
            <View style={styles.tipIconContainer}>
              <Ionicons name="alert-circle" size={20} color="#F59E0B" />
            </View>
            <View style={styles.tipContent}>
              <Text style={styles.tipTitle}>Stay Within Speed Limits</Text>
              <Text style={styles.tipText}>
                Speeding over 130 km/h significantly impacts your driving score.
              </Text>
            </View>
          </View>
        </View>

        {/* App Info */}
        <View style={styles.appInfo}>
          <Text style={styles.appName}>DriveIQ</Text>
          <Text style={styles.appVersion}>Version 1.0.0</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A1628',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingBottom: 32,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 16,
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
  avatarContainer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(0, 102, 204, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#0066CC',
  },
  driverLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginTop: 16,
  },
  mainScoreCard: {
    backgroundColor: '#0F1F38',
    marginHorizontal: 24,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#1E3A5F',
  },
  mainScoreLabel: {
    fontSize: 14,
    color: '#9CA3AF',
    marginBottom: 8,
  },
  mainScoreValue: {
    fontSize: 64,
    fontWeight: 'bold',
  },
  scoreBar: {
    width: '100%',
    height: 8,
    backgroundColor: '#1E3A5F',
    borderRadius: 4,
    marginTop: 16,
    overflow: 'hidden',
  },
  scoreBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 12,
  },
  statCard: {
    backgroundColor: '#0F1F38',
    borderRadius: 16,
    padding: 16,
    width: '47%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1E3A5F',
  },
  statIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  statValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
    textAlign: 'center',
  },
  tipsSection: {
    paddingHorizontal: 24,
    paddingTop: 32,
  },
  tipsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  tipCard: {
    flexDirection: 'row',
    backgroundColor: '#0F1F38',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#1E3A5F',
  },
  tipIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 102, 204, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  tipContent: {
    flex: 1,
  },
  tipTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  tipText: {
    fontSize: 14,
    color: '#9CA3AF',
    lineHeight: 20,
  },
  appInfo: {
    alignItems: 'center',
    paddingTop: 32,
  },
  appName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0066CC',
  },
  appVersion: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
});

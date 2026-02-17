import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

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

export default function TripDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTrip();
  }, [id]);

  const fetchTrip = async () => {
    try {
      const response = await fetch(`${API_URL}/api/trips/${id}`);
      if (response.ok) {
        const data = await response.json();
        setTrip(data);
      } else {
        Alert.alert('Error', 'Trip not found');
        router.back();
      }
    } catch (error) {
      console.error('Error fetching trip:', error);
      Alert.alert('Error', 'Failed to load trip details');
    } finally {
      setLoading(false);
    }
  };

  const deleteTrip = async () => {
    Alert.alert(
      'Delete Trip',
      'Are you sure you want to delete this trip?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await fetch(`${API_URL}/api/trips/${id}`, {
                method: 'DELETE',
              });
              if (response.ok) {
                router.back();
              } else {
                Alert.alert('Error', 'Failed to delete trip');
              }
            } catch (error) {
              console.error('Error deleting trip:', error);
              Alert.alert('Error', 'Failed to delete trip');
            }
          },
        },
      ]
    );
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
      time: date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      }),
    };
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) {
      return `${Math.round(minutes)} min`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hours}h ${mins}m`;
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return '#10B981';
    if (score >= 60) return '#F59E0B';
    return '#EF4444';
  };

  const getScoreGrade = (score: number) => {
    if (score >= 90) return 'Excellent';
    if (score >= 80) return 'Good';
    if (score >= 60) return 'Fair';
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

  if (!trip) {
    return null;
  }

  const startDateTime = formatDateTime(trip.start_time);
  const endDateTime = formatDateTime(trip.end_time);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Score Card */}
        <View style={styles.scoreCard}>
          <Text style={styles.scoreLabel}>Trip Score</Text>
          <Text style={[styles.scoreValue, { color: getScoreColor(trip.score) }]}>
            {trip.score}
          </Text>
          <View style={[styles.gradeContainer, { backgroundColor: getScoreColor(trip.score) + '20' }]}>
            <Text style={[styles.gradeText, { color: getScoreColor(trip.score) }]}>
              {getScoreGrade(trip.score)}
            </Text>
          </View>
        </View>

        {/* Time Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Trip Time</Text>
          <View style={styles.timeCard}>
            <View style={styles.timeRow}>
              <View style={styles.timeItem}>
                <View style={styles.timeIconContainer}>
                  <Ionicons name="play-circle" size={24} color="#10B981" />
                </View>
                <View style={styles.timeInfo}>
                  <Text style={styles.timeLabel}>Start</Text>
                  <Text style={styles.timeValue}>{startDateTime.time}</Text>
                  <Text style={styles.dateValue}>{startDateTime.date}</Text>
                </View>
              </View>
            </View>
            <View style={styles.timeDivider} />
            <View style={styles.timeRow}>
              <View style={styles.timeItem}>
                <View style={styles.timeIconContainer}>
                  <Ionicons name="stop-circle" size={24} color="#EF4444" />
                </View>
                <View style={styles.timeInfo}>
                  <Text style={styles.timeLabel}>End</Text>
                  <Text style={styles.timeValue}>{endDateTime.time}</Text>
                  <Text style={styles.dateValue}>{endDateTime.date}</Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Stats Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Trip Statistics</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Ionicons name="navigate" size={24} color="#0066CC" />
              <Text style={styles.statValue}>{trip.distance_km.toFixed(2)}</Text>
              <Text style={styles.statLabel}>Distance (km)</Text>
            </View>
            <View style={styles.statCard}>
              <Ionicons name="time" size={24} color="#8B5CF6" />
              <Text style={styles.statValue}>{formatDuration(trip.duration_minutes)}</Text>
              <Text style={styles.statLabel}>Duration</Text>
            </View>
            <View style={styles.statCard}>
              <Ionicons name="speedometer" size={24} color="#F59E0B" />
              <Text style={styles.statValue}>{trip.max_speed}</Text>
              <Text style={styles.statLabel}>Max Speed (km/h)</Text>
            </View>
            <View style={styles.statCard}>
              <Ionicons name="analytics" size={24} color="#10B981" />
              <Text style={styles.statValue}>{trip.avg_speed.toFixed(1)}</Text>
              <Text style={styles.statLabel}>Avg Speed (km/h)</Text>
            </View>
          </View>
        </View>

        {/* Events Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Driving Events</Text>
          <View style={styles.eventsCard}>
            <View style={styles.eventRow}>
              <View style={styles.eventItem}>
                <View style={[styles.eventIconContainer, { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}>
                  <Ionicons name="warning" size={20} color="#EF4444" />
                </View>
                <View style={styles.eventInfo}>
                  <Text style={styles.eventLabel}>Hard Brakes</Text>
                  <Text style={styles.eventValue}>{trip.hard_brakes}</Text>
                </View>
                <Text style={styles.eventPenalty}>-{trip.hard_brakes * 4} pts</Text>
              </View>
            </View>
            
            <View style={styles.eventDivider} />
            
            <View style={styles.eventRow}>
              <View style={styles.eventItem}>
                <View style={[styles.eventIconContainer, { backgroundColor: 'rgba(245, 158, 11, 0.1)' }]}>
                  <Ionicons name="flash" size={20} color="#F59E0B" />
                </View>
                <View style={styles.eventInfo}>
                  <Text style={styles.eventLabel}>Hard Accelerations</Text>
                  <Text style={styles.eventValue}>{trip.hard_accelerations}</Text>
                </View>
                <Text style={styles.eventPenalty}>-{trip.hard_accelerations * 4} pts</Text>
              </View>
            </View>
            
            <View style={styles.eventDivider} />
            
            <View style={styles.eventRow}>
              <View style={styles.eventItem}>
                <View style={[styles.eventIconContainer, { backgroundColor: 'rgba(139, 92, 246, 0.1)' }]}>
                  <Ionicons name="speedometer" size={20} color="#8B5CF6" />
                </View>
                <View style={styles.eventInfo}>
                  <Text style={styles.eventLabel}>Speeding ({'>'}130 km/h)</Text>
                  <Text style={styles.eventValue}>{trip.speeding_count}</Text>
                </View>
                <Text style={styles.eventPenalty}>-{trip.speeding_count * 8} pts</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Delete Button */}
        <TouchableOpacity style={styles.deleteButton} onPress={deleteTrip} activeOpacity={0.7}>
          <Ionicons name="trash-outline" size={20} color="#EF4444" />
          <Text style={styles.deleteText}>Delete Trip</Text>
        </TouchableOpacity>
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
    padding: 24,
    paddingBottom: 40,
  },
  scoreCard: {
    backgroundColor: '#0F1F38',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#1E3A5F',
  },
  scoreLabel: {
    fontSize: 14,
    color: '#9CA3AF',
    marginBottom: 8,
  },
  scoreValue: {
    fontSize: 72,
    fontWeight: 'bold',
  },
  gradeContainer: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 12,
    marginTop: 8,
  },
  gradeText: {
    fontSize: 16,
    fontWeight: '600',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  timeCard: {
    backgroundColor: '#0F1F38',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1E3A5F',
  },
  timeRow: {
    paddingVertical: 8,
  },
  timeItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#0A1628',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  timeInfo: {
    flex: 1,
  },
  timeLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  timeValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  dateValue: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  timeDivider: {
    height: 1,
    backgroundColor: '#1E3A5F',
    marginVertical: 8,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
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
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
    textAlign: 'center',
  },
  eventsCard: {
    backgroundColor: '#0F1F38',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1E3A5F',
  },
  eventRow: {
    paddingVertical: 8,
  },
  eventItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  eventIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  eventInfo: {
    flex: 1,
  },
  eventLabel: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  eventValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  eventPenalty: {
    fontSize: 14,
    color: '#EF4444',
    fontWeight: '600',
  },
  eventDivider: {
    height: 1,
    backgroundColor: '#1E3A5F',
    marginVertical: 8,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EF4444',
    gap: 8,
    marginTop: 8,
  },
  deleteText: {
    fontSize: 16,
    color: '#EF4444',
    fontWeight: '600',
  },
});

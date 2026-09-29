import React from 'react';
import { Linking, Platform, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { useApp } from '../../lib/AppContext';
import { colors } from '../../lib/theme';
import { fill } from '../../lib/i18n';
import { formatDate, formatTime } from '../../lib/format';
import ScoreRing from '../../components/ScoreRing';

export default function TripDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t, trips, locale } = useApp();
  const trip = trips.find((x) => x.id === id);

  if (!trip) {
    return (
      <SafeAreaView style={styles.container}>
        <BackButton onPress={() => router.back()} />
      </SafeAreaView>
    );
  }

  const openRoute = () => {
    const { startCoord: s, endCoord: e } = trip;
    if (!s || !e) return;
    const url =
      Platform.OS === 'ios'
        ? `http://maps.apple.com/?saddr=${s.latitude},${s.longitude}&daddr=${e.latitude},${e.longitude}`
        : `https://www.google.com/maps/dir/?api=1&origin=${s.latitude},${s.longitude}&destination=${e.latitude},${e.longitude}`;
    Linking.openURL(url).catch(() => {});
  };

  const share = () =>
    Share.share({
      message: fill(t.shareText, { SCORE: trip.score, DIST: trip.distance.toFixed(1), DUR: trip.duration }),
    }).catch(() => {});

  const hasRoute = !!(trip.startCoord && trip.endCoord && trip.startCoord.latitude !== 0);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.topRow}>
          <BackButton onPress={() => router.back()} />
          <TouchableOpacity onPress={share} style={styles.iconBtn}>
            <Ionicons name="share-outline" size={22} color={colors.primary} />
          </TouchableOpacity>
        </View>

        <Text style={styles.title}>{t.tripDetails}</Text>
        <Text style={styles.subtitle}>
          {formatDate(trip.startedAt, locale)} · {formatTime(trip.startedAt, locale)} – {formatTime(trip.endedAt, locale)}
        </Text>
        <View style={styles.sourceChip}>
          <Text style={styles.sourceText}>{trip.source === 'manual' ? t.manualLabel : t.autoLabel}</Text>
        </View>

        <View style={styles.ring}>
          <ScoreRing score={trip.score} size={150} label={t.score} />
        </View>

        <View style={styles.grid}>
          <Cell icon="navigate" value={`${trip.distance.toFixed(1)} ${t.km}`} label={t.distance} />
          <Cell icon="time" value={`${trip.duration} ${t.min}`} label={t.duration} />
          <Cell icon="speedometer" value={`${trip.avgSpeed} ${t.kmh}`} label={t.avgSpeed} />
          <Cell icon="flash" value={`${trip.maxSpeed} ${t.kmh}`} label={t.maxSpeed} />
        </View>

        <View style={styles.events}>
          <EventRow icon="hand-left" label={t.hardBrakes} value={trip.hardBrakes} penalty={4} />
          <EventRow icon="rocket" label={t.hardAccel} value={trip.hardAccel} penalty={4} />
          <EventRow icon="alert-circle" label={t.speeding} value={trip.speedingEvents} penalty={8} />
        </View>

        {hasRoute && (
          <TouchableOpacity style={styles.mapBtn} onPress={openRoute}>
            <Ionicons name="map-outline" size={20} color="#fff" />
            <Text style={styles.mapText}>{t.showRoute}</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function BackButton({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.iconBtn}>
      <Ionicons name="chevron-back" size={24} color={colors.primary} />
    </TouchableOpacity>
  );
}

function Cell({ icon, value, label }: { icon: any; value: string; label: string }) {
  return (
    <View style={styles.cell}>
      <Ionicons name={icon} size={18} color={colors.primary} />
      <Text style={styles.cellVal}>{value}</Text>
      <Text style={styles.cellLabel}>{label}</Text>
    </View>
  );
}

function EventRow({ icon, label, value, penalty }: { icon: any; label: string; value: number; penalty: number }) {
  const color = value ? colors.warn : colors.good;
  return (
    <View style={styles.eventRow}>
      <Ionicons name={icon} size={20} color={color} />
      <Text style={styles.eventLabel}>{label}</Text>
      <Text style={[styles.eventVal, { color }]}>{value}</Text>
      <Text style={styles.eventPenalty}>{value ? `−${value * penalty}` : '✓'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 20, paddingBottom: 40 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between' },
  iconBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: { color: colors.text, fontSize: 26, fontWeight: '900', marginTop: 16 },
  subtitle: { color: colors.textDim, fontSize: 14, marginTop: 4 },
  sourceChip: {
    alignSelf: 'flex-start',
    marginTop: 8,
    backgroundColor: 'rgba(0,170,255,0.12)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  sourceText: { color: colors.primary, fontSize: 12, fontWeight: '700' },
  ring: { alignItems: 'center', marginVertical: 24 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  cell: {
    width: '48%',
    flexGrow: 1,
    backgroundColor: colors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
  },
  cellVal: { color: colors.text, fontSize: 20, fontWeight: '800', marginTop: 8 },
  cellLabel: { color: colors.textMute, fontSize: 12, marginTop: 2 },
  events: {
    marginTop: 16,
    backgroundColor: colors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
  },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  eventLabel: { flex: 1, color: colors.text, fontSize: 15 },
  eventVal: { fontSize: 17, fontWeight: '800', minWidth: 24, textAlign: 'center' },
  eventPenalty: { color: colors.textMute, fontSize: 13, minWidth: 34, textAlign: 'right' },
  mapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 20,
    backgroundColor: colors.primary,
    borderRadius: 16,
    padding: 16,
  },
  mapText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});

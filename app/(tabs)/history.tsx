import React, { useMemo } from 'react';
import { SectionList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { useApp } from '../../lib/AppContext';
import { colors, scoreColor } from '../../lib/theme';
import { formatDate, formatTime, startOfDay } from '../../lib/format';
import type { Trip } from '../../lib/storage';

export default function HistoryScreen() {
  const { t, trips, locale } = useApp();
  const router = useRouter();

  const week = useMemo(() => {
    const since = Date.now() - 7 * 24 * 3600 * 1000;
    const list = trips.filter((x) => x.startedAt >= since);
    return {
      count: list.length,
      km: list.reduce((s, x) => s + x.distance, 0),
      score: list.length ? Math.round(list.reduce((s, x) => s + x.score, 0) / list.length) : null,
    };
  }, [trips]);

  const sections = useMemo(() => {
    const map = new Map<number, Trip[]>();
    trips.forEach((x) => {
      const day = startOfDay(x.startedAt);
      map.set(day, [...(map.get(day) ?? []), x]);
    });
    return [...map.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([day, data]) => ({ title: formatDate(day, locale), data }));
  }, [trips, locale]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Text style={styles.title}>{t.history}</Text>

      <View style={styles.summary}>
        <Summary value={String(week.count)} label={t.trips} />
        <View style={styles.divider} />
        <Summary value={week.km.toFixed(1)} label={t.km} />
        <View style={styles.divider} />
        <Summary value={week.score == null ? '--' : String(week.score)} label={t.avgScore} color={scoreColor(week.score)} />
      </View>
      <Text style={styles.summaryCaption}>{t.thisWeek}</Text>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section }) => <Text style={styles.section}>{section.title}</Text>}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            activeOpacity={0.8}
            onPress={() => router.push({ pathname: '/trip/[id]', params: { id: item.id } })}
          >
            <View style={[styles.badge, { borderColor: scoreColor(item.score) }]}>
              <Text style={[styles.badgeText, { color: scoreColor(item.score) }]}>{item.score}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTime}>
                {formatTime(item.startedAt, locale)} – {formatTime(item.endedAt, locale)}
              </Text>
              <Text style={styles.cardMeta}>
                {item.distance.toFixed(1)} {t.km} · {item.duration} {t.min} · {item.avgSpeed} {t.kmh}
              </Text>
            </View>
            {item.hardBrakes + item.hardAccel + item.speedingEvents > 0 && (
              <View style={styles.eventChip}>
                <Ionicons name="warning" size={12} color={colors.warn} />
                <Text style={styles.eventText}>{item.hardBrakes + item.hardAccel + item.speedingEvents}</Text>
              </View>
            )}
            <Ionicons name="chevron-forward" size={18} color={colors.textMute} />
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🚗</Text>
            <Text style={styles.emptyText}>{t.noTrips}</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

function Summary({ value, label, color }: { value: string; label: string; color?: string }) {
  return (
    <View style={styles.summaryItem}>
      <Text style={[styles.summaryVal, color ? { color } : null]}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  title: { color: colors.text, fontSize: 28, fontWeight: '900', paddingHorizontal: 20, paddingTop: 12 },
  summary: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 16,
    backgroundColor: colors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 16,
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryVal: { color: colors.text, fontSize: 22, fontWeight: '900' },
  summaryLabel: { color: colors.textMute, fontSize: 12, marginTop: 2 },
  summaryCaption: { color: colors.textMute, fontSize: 12, textAlign: 'center', marginTop: 6 },
  divider: { width: 1, backgroundColor: colors.border },
  list: { padding: 20, paddingTop: 8, paddingBottom: 40 },
  section: { color: colors.textDim, fontSize: 13, fontWeight: '700', marginTop: 16, marginBottom: 8 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 10,
  },
  badge: { width: 50, height: 50, borderRadius: 25, borderWidth: 2.5, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontSize: 17, fontWeight: '900' },
  cardTime: { color: colors.text, fontSize: 15, fontWeight: '700' },
  cardMeta: { color: colors.textDim, fontSize: 13, marginTop: 3 },
  eventChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(245,158,11,0.12)',
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  eventText: { color: colors.warn, fontSize: 12, fontWeight: '700' },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyIcon: { fontSize: 56, marginBottom: 12 },
  emptyText: { color: colors.textMute, fontSize: 15, textAlign: 'center', lineHeight: 23 },
});

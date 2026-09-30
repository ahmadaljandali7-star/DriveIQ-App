import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { useApp } from '../../lib/AppContext';
import { colors } from '../../lib/theme';
import { fill } from '../../lib/i18n';
import { formatClock, startOfDay } from '../../lib/format';
import SpeedGauge from '../../components/SpeedGauge';
import ScoreRing from '../../components/ScoreRing';

export default function DriveScreen() {
  const { t, userName, profilePhoto, trips, activeTrip, currentSpeed, permission, autoDetect, startTrip, stopTrip } =
    useApp();
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  const recording = activeTrip !== null;

  useEffect(() => {
    if (!recording) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [recording]);

  const today = useMemo(() => {
    const since = startOfDay();
    const list = trips.filter((x) => x.startedAt >= since);
    return {
      count: list.length,
      km: list.reduce((s, x) => s + x.distance, 0),
      score: list.length ? Math.round(list.reduce((s, x) => s + x.score, 0) / list.length) : null,
    };
  }, [trips]);

  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.value = recording
      ? withRepeat(withSequence(withTiming(0.3, { duration: 700 }), withTiming(1, { duration: 700 })), -1)
      : withTiming(1);
  }, [recording]);
  const dotStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  const status =
    permission === 'none'
      ? { text: t.statusNoPerm, color: colors.bad }
      : recording
        ? { text: t.statusRecording, color: colors.good }
        : autoDetect
          ? { text: t.statusReady, color: colors.primary }
          : { text: t.statusOff, color: colors.textMute };

  const onPress = async () => {
    setBusy(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    try {
      if (recording) await stopTrip();
      else await startTrip();
    } finally {
      setBusy(false);
    }
  };

  const events = activeTrip ? activeTrip.hardBrakes + activeTrip.hardAccel + activeTrip.speedingEvents : 0;

  return (
    <LinearGradient colors={[colors.bgDeep, '#0F2847', colors.bg]} style={styles.flex}>
      <SafeAreaView style={styles.flex} edges={['top']}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.brand}>DriveIQ</Text>
              <Text style={styles.hello}>{fill(t.hello, { NAME: userName })}</Text>
            </View>
            <View style={styles.avatar}>
              {profilePhoto ? (
                <Image source={{ uri: profilePhoto }} style={styles.avatarImg} />
              ) : (
                <Text style={styles.avatarLetter}>{userName.charAt(0).toUpperCase()}</Text>
              )}
            </View>
          </View>

          <View style={[styles.statusPill, { borderColor: status.color }]}>
            <Animated.View style={[styles.dot, { backgroundColor: status.color }, dotStyle]} />
            <Text style={[styles.statusText, { color: status.color }]}>{status.text}</Text>
          </View>

          <View style={styles.gaugeCard}>
            <SpeedGauge speed={currentSpeed} unit={t.kmh} />
            {recording && activeTrip && (
              <View style={styles.liveRow}>
                <Live icon="time-outline" value={formatClock(now - activeTrip.startedAt)} label={t.duration} />
                <Live icon="navigate-outline" value={activeTrip.distance.toFixed(1)} label={t.km} />
                <Live
                  icon="warning-outline"
                  value={String(events)}
                  label={t.events}
                  color={events ? colors.warn : undefined}
                />
              </View>
            )}
          </View>

          {permission === 'foreground' && autoDetect && (
            <TouchableOpacity style={styles.warnCard} onPress={() => Linking.openSettings()}>
              <Ionicons name="location-outline" size={22} color={colors.warn} />
              <View style={{ flex: 1 }}>
                <Text style={styles.warnText}>{t.bgPermWarn}</Text>
                <Text style={styles.warnLink}>{t.openSettings} ›</Text>
              </View>
            </TouchableOpacity>
          )}

          <View style={styles.todayCard}>
            <ScoreRing score={today.score} size={92} />
            <View style={styles.todayInfo}>
              <Text style={styles.cardTitle}>{t.todayScore}</Text>
              {today.count ? (
                <View style={styles.todayStats}>
                  <View>
                    <Text style={styles.todayVal}>{today.count}</Text>
                    <Text style={styles.todayLabel}>{t.tripsToday}</Text>
                  </View>
                  <View>
                    <Text style={styles.todayVal}>
                      {today.km.toFixed(1)} <Text style={styles.todayUnit}>{t.km}</Text>
                    </Text>
                    <Text style={styles.todayLabel}>{t.kmToday}</Text>
                  </View>
                </View>
              ) : (
                <Text style={styles.todayEmpty}>{t.noTripsToday}</Text>
              )}
            </View>
          </View>
        </ScrollView>

        <View style={styles.bottom}>
          <TouchableOpacity activeOpacity={0.85} onPress={onPress} disabled={busy}>
            <LinearGradient
              colors={recording ? ['#EF4444', '#B91C1C'] : [colors.primary, colors.primaryDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.mainBtn}
            >
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name={recording ? 'stop-circle' : 'play-circle'} size={28} color="#fff" />
                  <Text style={styles.mainBtnText}>{recording ? t.endTrip : t.startTrip}</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

function Live({ icon, value, label, color }: { icon: any; value: string; label: string; color?: string }) {
  return (
    <View style={styles.liveItem}>
      <Ionicons name={icon} size={18} color={color ?? colors.primary} />
      <Text style={[styles.liveVal, color ? { color } : null]}>{value}</Text>
      <Text style={styles.liveLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 20, paddingBottom: 24, gap: 16 },
  header: { flexDirection: 'row', alignItems: 'center' },
  brand: { fontSize: 30, fontWeight: '900', color: colors.text, letterSpacing: 0.5 },
  hello: { fontSize: 15, color: colors.textDim, marginTop: 2 },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.cardHi,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: { width: '100%', height: '100%' },
  avatarLetter: { color: colors.text, fontSize: 20, fontWeight: '800' },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: 'rgba(15,31,61,0.7)',
  },
  dot: { width: 9, height: 9, borderRadius: 5 },
  statusText: { fontSize: 13, fontWeight: '700' },
  gaugeCard: {
    backgroundColor: 'rgba(15,31,61,0.85)',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    paddingVertical: 20,
  },
  liveRow: { flexDirection: 'row', alignSelf: 'stretch', justifyContent: 'space-around', marginTop: 8 },
  liveItem: { alignItems: 'center', minWidth: 80 },
  liveVal: { color: colors.text, fontSize: 22, fontWeight: '800', marginTop: 4, fontVariant: ['tabular-nums'] },
  liveLabel: { color: colors.textMute, fontSize: 12, marginTop: 2 },
  warnCard: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    backgroundColor: 'rgba(245,158,11,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.4)',
    borderRadius: 18,
    padding: 14,
  },
  warnText: { color: colors.text, fontSize: 13, lineHeight: 19 },
  warnLink: { color: colors.warn, fontSize: 13, fontWeight: '700', marginTop: 4 },
  todayCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    backgroundColor: colors.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
  },
  todayInfo: { flex: 1 },
  cardTitle: { color: colors.textDim, fontSize: 14, fontWeight: '700', marginBottom: 8 },
  todayStats: { flexDirection: 'row', gap: 28 },
  todayVal: { color: colors.text, fontSize: 22, fontWeight: '800' },
  todayUnit: { fontSize: 13, color: colors.textDim, fontWeight: '600' },
  todayLabel: { color: colors.textMute, fontSize: 12, marginTop: 2 },
  todayEmpty: { color: colors.textMute, fontSize: 14 },
  bottom: { paddingHorizontal: 20, paddingBottom: 12, paddingTop: 4 },
  mainBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: 20,
    paddingVertical: 18,
  },
  mainBtnText: { color: '#fff', fontSize: 18, fontWeight: '800' },
});

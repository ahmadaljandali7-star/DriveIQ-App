import React, { useMemo, useState } from 'react';
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import Constants from 'expo-constants';

import { useApp } from '../../lib/AppContext';
import { LANGUAGES } from '../../lib/i18n';
import { colors, scoreColor } from '../../lib/theme';
import { computeAchievements } from '../../lib/achievements';

export default function ProfileScreen() {
  const {
    t,
    userName,
    saveUserName,
    profilePhoto,
    saveProfilePhoto,
    language,
    saveLanguage,
    powerSaving,
    savePowerSaving,
    autoDetect,
    saveAutoDetect,
    stats,
    trips,
  } = useApp();
  const [editing, setEditing] = useState(false);
  const [nameInput, setNameInput] = useState(userName);
  const achievements = useMemo(() => computeAchievements(trips, t), [trips, t]);

  const pick = async (camera: boolean) => {
    const perm = camera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') {
      Alert.alert(t.permNeeded);
      return;
    }
    const opts: ImagePicker.ImagePickerOptions = {
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    };
    const res = camera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    if (!res.canceled && res.assets[0]) await saveProfilePhoto(res.assets[0].uri);
  };

  const photoOptions = () =>
    Alert.alert(t.photoTitle, undefined, [
      { text: t.photoGallery, onPress: () => pick(false) },
      { text: t.photoCamera, onPress: () => pick(true) },
      { text: t.cancel, style: 'cancel' },
    ]);

  const saveName = async () => {
    if (nameInput.trim().length >= 2) await saveUserName(nameInput);
    setEditing(false);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <TouchableOpacity style={styles.avatarWrap} onPress={photoOptions}>
          {profilePhoto ? (
            <Image source={{ uri: profilePhoto }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarLetter}>{userName.charAt(0).toUpperCase() || '?'}</Text>
            </View>
          )}
          <View style={styles.camBtn}>
            <Ionicons name="camera" size={15} color="#fff" />
          </View>
        </TouchableOpacity>

        {editing ? (
          <View style={styles.nameRow}>
            <TextInput
              style={styles.nameInput}
              value={nameInput}
              onChangeText={setNameInput}
              autoFocus
              maxLength={30}
              onSubmitEditing={saveName}
            />
            <TouchableOpacity style={styles.saveBtn} onPress={saveName}>
              <Text style={styles.saveText}>{t.save}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            onPress={() => {
              setNameInput(userName);
              setEditing(true);
            }}
          >
            <Text style={styles.name}>{userName}</Text>
            <Text style={styles.editHint}>{t.editName} ✏️</Text>
          </TouchableOpacity>
        )}

        <View style={styles.statsGrid}>
          <Stat value={String(stats.totalTrips)} label={t.totalTrips} />
          <Stat value={`${stats.totalDistance}`} unit={t.km} label={t.totalDistance} />
          <Stat value={stats.totalTrips ? String(stats.avgScore) : '--'} label={t.avgScore} color={scoreColor(stats.totalTrips ? stats.avgScore : null)} />
          <Stat value={stats.totalTrips ? String(stats.bestScore) : '--'} label={t.bestScore} color={scoreColor(stats.totalTrips ? stats.bestScore : null)} />
        </View>

        <Text style={styles.section}>{t.achievements}</Text>
        <View style={styles.achGrid}>
          {achievements.map((a) => (
            <View key={a.id} style={[styles.ach, !a.unlocked && styles.achLocked]}>
              <Text style={styles.achIcon}>{a.icon}</Text>
              <Text style={styles.achTitle} numberOfLines={1}>
                {a.title}
              </Text>
              <Text style={styles.achDesc} numberOfLines={2}>
                {a.desc}
              </Text>
              {!a.unlocked && a.progress > 0 && (
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${Math.round(a.progress * 100)}%` }]} />
                </View>
              )}
              {a.unlocked && <Ionicons name="checkmark-circle" size={18} color={colors.good} style={styles.achCheck} />}
            </View>
          ))}
        </View>

        <Text style={styles.section}>{t.settings}</Text>
        <View style={styles.settings}>
          <SettingSwitch
            icon="car-sport"
            label={t.autoDetect}
            hint={t.autoDetectHint}
            value={autoDetect}
            onChange={saveAutoDetect}
          />
          <SettingSwitch
            icon="battery-half"
            label={t.powerSaving}
            hint={t.powerSavingHint}
            value={powerSaving}
            onChange={savePowerSaving}
          />
          <View style={styles.settingRow}>
            <Ionicons name="language" size={20} color={colors.primary} />
            <Text style={styles.settingLabel}>{t.language}</Text>
          </View>
          <View style={styles.langRow}>
            {LANGUAGES.map((l) => (
              <TouchableOpacity
                key={l.code}
                style={[styles.langBtn, language === l.code && styles.langBtnActive]}
                onPress={() => saveLanguage(l.code)}
              >
                <Text style={[styles.langText, language === l.code && styles.langTextActive]}>{l.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <Text style={styles.footer}>
          DriveIQ · {t.version} {Constants.expoConfig?.version ?? ''}
          {'\n'}
          {t.privacyNote}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ value, unit, label, color }: { value: string; unit?: string; label: string; color?: string }) {
  return (
    <View style={styles.statCell}>
      <Text style={[styles.statVal, color ? { color } : null]}>
        {value}
        {unit ? <Text style={styles.statUnit}> {unit}</Text> : null}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function SettingSwitch({
  icon,
  label,
  hint,
  value,
  onChange,
}: {
  icon: any;
  label: string;
  hint: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.settingRow}>
      <Ionicons name={icon} size={20} color={colors.primary} />
      <View style={{ flex: 1 }}>
        <Text style={styles.settingLabel}>{label}</Text>
        <Text style={styles.settingHint}>{hint}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: colors.primary, false: colors.border }}
        thumbColor="#fff"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 20, paddingBottom: 40, alignItems: 'center' },
  avatarWrap: { marginTop: 8, marginBottom: 12 },
  avatar: { width: 104, height: 104, borderRadius: 52, borderWidth: 3, borderColor: colors.primary },
  avatarPlaceholder: { backgroundColor: colors.cardHi, alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { color: colors.text, fontSize: 44, fontWeight: '900' },
  camBtn: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.bg,
  },
  name: { color: colors.text, fontSize: 26, fontWeight: '900', textAlign: 'center' },
  editHint: { color: colors.textMute, fontSize: 13, textAlign: 'center', marginTop: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 10, alignSelf: 'stretch' },
  nameInput: {
    flex: 1,
    backgroundColor: colors.card,
    color: colors.text,
    borderRadius: 12,
    padding: 12,
    fontSize: 18,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  saveBtn: { backgroundColor: colors.primary, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 13 },
  saveText: { color: '#fff', fontWeight: '800' },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignSelf: 'stretch',
    marginTop: 24,
    backgroundColor: colors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  statCell: { width: '50%', padding: 16, alignItems: 'center' },
  statVal: { color: colors.text, fontSize: 24, fontWeight: '900' },
  statUnit: { fontSize: 13, color: colors.textDim, fontWeight: '600' },
  statLabel: { color: colors.textMute, fontSize: 12, marginTop: 2 },
  section: {
    alignSelf: 'stretch',
    color: colors.textDim,
    fontSize: 14,
    fontWeight: '800',
    marginTop: 28,
    marginBottom: 12,
  },
  achGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignSelf: 'stretch' },
  ach: {
    width: '48%',
    flexGrow: 1,
    backgroundColor: colors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    minHeight: 120,
  },
  achLocked: { opacity: 0.45 },
  achIcon: { fontSize: 28 },
  achTitle: { color: colors.text, fontSize: 14, fontWeight: '800', marginTop: 6 },
  achDesc: { color: colors.textMute, fontSize: 12, marginTop: 2, lineHeight: 16 },
  achCheck: { position: 'absolute', top: 10, right: 10 },
  progressTrack: { height: 4, borderRadius: 2, backgroundColor: colors.border, marginTop: 8 },
  progressFill: { height: 4, borderRadius: 2, backgroundColor: colors.primary },
  settings: {
    alignSelf: 'stretch',
    backgroundColor: colors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 16,
  },
  settingRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  settingLabel: { color: colors.text, fontSize: 15, fontWeight: '600' },
  settingHint: { color: colors.textMute, fontSize: 12, marginTop: 2 },
  langRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  langBtn: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  langBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  langText: { color: colors.textDim, fontSize: 14 },
  langTextActive: { color: '#fff', fontWeight: '800' },
  footer: { color: colors.textMute, fontSize: 12, textAlign: 'center', marginTop: 28, lineHeight: 18 },
});

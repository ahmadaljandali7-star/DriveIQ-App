import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../lib/AppContext';
import { LANGUAGES } from '../lib/i18n';
import { colors } from '../lib/theme';

export default function WelcomeScreen() {
  const { t, language, saveLanguage, saveUserName, askPermission } = useApp();
  const [step, setStep] = useState<'name' | 'permission'>('name');
  const [name, setName] = useState('');
  const valid = name.trim().length >= 2;

  const finish = async (withPermission: boolean) => {
    if (withPermission) await askPermission();
    await saveUserName(name); // root layout then navigates to the tabs
  };

  return (
    <LinearGradient colors={[colors.bgDeep, '#0F2847', colors.bg]} style={styles.flex}>
      <SafeAreaView style={styles.flex}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.langRow}>
            {LANGUAGES.map((l) => (
              <TouchableOpacity
                key={l.code}
                onPress={() => saveLanguage(l.code)}
                style={[styles.langChip, language === l.code && styles.langChipActive]}
              >
                <Text style={[styles.langText, language === l.code && styles.langTextActive]}>{l.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.inner}>
            <View style={styles.logoCircle}>
              <Ionicons name="speedometer" size={48} color={colors.primary} />
            </View>
            <Text style={styles.logo}>DriveIQ</Text>
            <Text style={styles.tagline}>{t.appTagline}</Text>

            {step === 'name' ? (
              <View style={styles.card}>
                <Text style={styles.title}>{t.welcomeTitle}</Text>
                <Text style={styles.body}>{t.welcomeSub}</Text>
                <Text style={styles.label}>{t.yourName}</Text>
                <TextInput
                  style={styles.input}
                  placeholder={t.enterName}
                  placeholderTextColor={colors.textMute}
                  value={name}
                  onChangeText={setName}
                  maxLength={30}
                  returnKeyType="next"
                  onSubmitEditing={() => valid && setStep('permission')}
                />
                <TouchableOpacity
                  style={[styles.btn, !valid && styles.btnDisabled]}
                  disabled={!valid}
                  onPress={() => setStep('permission')}
                >
                  <Text style={styles.btnText}>{t.continue}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.card}>
                <Ionicons name="location" size={36} color={colors.primary} style={{ alignSelf: 'center' }} />
                <Text style={styles.title}>{t.permTitle}</Text>
                <Text style={styles.body}>{t.permBody}</Text>
                <TouchableOpacity style={styles.btn} onPress={() => finish(true)}>
                  <Text style={styles.btnText}>{t.permAllow}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.linkBtn} onPress={() => finish(false)}>
                  <Text style={styles.linkText}>{t.permLater}</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  langRow: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: 8, paddingTop: 12 },
  langChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16, borderWidth: 1, borderColor: colors.border },
  langChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  langText: { color: colors.textDim, fontSize: 13 },
  langTextActive: { color: '#fff', fontWeight: '700' },
  inner: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  logoCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(0,170,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  logo: { fontSize: 42, fontWeight: '900', color: colors.text, letterSpacing: 1 },
  tagline: { fontSize: 15, color: colors.textDim, marginBottom: 32 },
  card: {
    width: '100%',
    backgroundColor: colors.card,
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  title: { color: colors.text, fontSize: 20, fontWeight: '800', textAlign: 'center' },
  body: { color: colors.textDim, fontSize: 14, lineHeight: 21, textAlign: 'center', marginBottom: 8 },
  label: { color: colors.primary, fontSize: 13, fontWeight: '700' },
  input: {
    backgroundColor: colors.bg,
    color: colors.text,
    borderRadius: 14,
    padding: 16,
    fontSize: 18,
    borderWidth: 1,
    borderColor: colors.border,
  },
  btn: { backgroundColor: colors.primary, borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 4 },
  btnDisabled: { opacity: 0.4 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  linkBtn: { alignItems: 'center', padding: 8 },
  linkText: { color: colors.textDim, fontSize: 14 },
});

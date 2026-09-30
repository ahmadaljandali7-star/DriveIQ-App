import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../../lib/AppContext';
import { colors } from '../../lib/theme';

export default function TabLayout() {
  const { t } = useApp();
  const insets = useSafeAreaInsets();

  const icon =
    (on: keyof typeof Ionicons.glyphMap, off: keyof typeof Ionicons.glyphMap) =>
    ({ color, focused }: { color: string; focused: boolean }) =>
      <Ionicons name={focused ? on : off} size={24} color={color} />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMute,
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
        tabBarStyle: {
          backgroundColor: colors.bgDeep,
          borderTopColor: colors.border,
          height: 62 + insets.bottom,
          paddingBottom: Math.max(insets.bottom, 8),
          paddingTop: 8,
        },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t.today, tabBarIcon: icon('speedometer', 'speedometer-outline') }} />
      <Tabs.Screen name="history" options={{ title: t.history, tabBarIcon: icon('time', 'time-outline') }} />
      <Tabs.Screen name="profile" options={{ title: t.profile, tabBarIcon: icon('person', 'person-outline') }} />
    </Tabs>
  );
}

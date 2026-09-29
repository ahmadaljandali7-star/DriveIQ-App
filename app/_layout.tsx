import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppProvider, useApp } from '../lib/AppContext';
import Toast from '../components/Toast';
import { colors } from '../lib/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

function RootNavigator() {
  const { isLoaded, userName, toast } = useApp();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!isLoaded) return;
    SplashScreen.hideAsync().catch(() => {});
    const onWelcome = segments[0] === 'welcome';
    if (!userName && !onWelcome) router.replace('/welcome');
    else if (userName && onWelcome) router.replace('/');
  }, [isLoaded, userName, segments]);

  if (!isLoaded) return <View style={styles.container} />;

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="welcome" options={{ animation: 'fade' }} />
      </Stack>
      <Toast message={toast} />
    </View>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.container}>
      <SafeAreaProvider>
        <AppProvider>
          <RootNavigator />
        </AppProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
});

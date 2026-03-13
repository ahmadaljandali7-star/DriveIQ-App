import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet } from 'react-native';
import { checkTaskStatus } from './locationTask';

export default function RootLayout() {
  useEffect(() => {
    // Verify task is ready when app loads
    const verifyTask = async () => {
      console.log('[RootLayout] Verifying background task...');
      const status = await checkTaskStatus();
      
      if (!status.isDefined) {
        console.error('[RootLayout] WARNING: Background task not defined!');
      } else {
        console.log('[RootLayout] Background task verified successfully');
      }
    };

    verifyTask();
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A1628',
  },
});

import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet } from 'react-native';

// Import location task and helper functions
import './locationTask';
import { ensureTaskReady, checkTaskStatus } from './locationTask';

export default function RootLayout() {
  useEffect(() => {
    // Check task status when app loads
    const initTask = async () => {
      console.log('[RootLayout] 🔧 Initializing task system...');
      const isReady = await ensureTaskReady();
      console.log(`[RootLayout] 📊 Task ready: ${isReady}`);
      
      // Double check with detailed status
      const status = await checkTaskStatus();
      console.log('[RootLayout] 📊 Detailed status:', status);
    };
    
    initTask();
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#0A1628' },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="trip/[id]"
          options={{
            headerShown: true,
            headerTitle: 'Trip Details',
            headerStyle: { backgroundColor: '#0A1628' },
            headerTintColor: '#FFFFFF',
            headerBackTitle: 'Back',
            animation: 'slide_from_right',
          }}
        />
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

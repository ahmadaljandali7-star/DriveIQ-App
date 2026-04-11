import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { checkTaskStatus } from './locationTask';

export default function RootLayout() {
  useEffect(() => {
    // Verify background task is ready when app loads
    const verifyTask = async () => {
      console.log('[RootLayout] Verifying background task...');
      const status = await checkTaskStatus();
      
      if (!status.isDefined) {
        console.error('[RootLayout] WARNING: Background task not defined!');
        console.error('[RootLayout] Make sure index.js is the entry point');
      } else {
        console.log('[RootLayout] ✅ Background task verified successfully');
      }
    };
    
    verifyTask();
  }, []);
  
  return (
    <GestureHandlerRootView style={styles.container}>
      <View style={styles.container}>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: '#0A1628' },
            animation: 'slide_from_right',
          }}
        />
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A1628',
  },
});

import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet } from 'react-native';
// Import location task to ensure it's registered before any screens load
import './locationTask';
export default function RootLayout() {
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

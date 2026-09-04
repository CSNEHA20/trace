import React from 'react';
import { PaperProvider } from 'react-native-paper';
import { ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { theme, navigationTheme } from '../src/theme';

export default function RootLayout() {
  return (
    <PaperProvider theme={theme}>
      <ThemeProvider value={navigationTheme}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="case/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="evidence/[id]" options={{ headerShown: false }} />
        </Stack>
      </ThemeProvider>
    </PaperProvider>
  );
}

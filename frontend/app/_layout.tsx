import React, { useEffect, useState } from 'react';
import { LogBox, View, ActivityIndicator } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PaperProvider } from 'react-native-paper';
import { ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as Font from 'expo-font';
import { theme, navigationTheme, Colors } from '../src/theme';

LogBox.ignoreAllLogs(true);
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [fontsLoaded, setFontsLoaded] = useState(true);

  useEffect(() => {
    async function loadResources() {
      try {
        await Font.loadAsync({
          'MangoGrotesque': require('../assets/fonts/Anton-Regular.ttf'),
          'MaghfireaSerif': require('../assets/fonts/PlayfairDisplay-Bold.ttf'),
          'MattoneSans': require('../assets/fonts/PlusJakartaSans-Bold.ttf'),
          'CinzelSerif': require('../assets/fonts/Cinzel-Bold.ttf'),
        });
      } catch (e) {
        console.warn('Font loading failed (native assets used):', e);
      } finally {
        setFontsLoaded(true);
        try {
          await SplashScreen.hideAsync();
        } catch {
          // ignore
        }
      }
    }

    loadResources();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PaperProvider theme={theme}>
          <ThemeProvider value={navigationTheme}>
            <StatusBar style="dark" />
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="case/[id]" options={{ headerShown: false }} />
              <Stack.Screen name="evidence/[id]" options={{ headerShown: false }} />
              <Stack.Screen name="ai-status" options={{ headerShown: false }} />
            </Stack>
          </ThemeProvider>
        </PaperProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
import React from 'react';
import { Tabs } from 'expo-router';
import { palette } from '../../src/theme';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: palette.surface,
          borderTopColor: palette.border,
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarActiveTintColor: palette.primary,
        tabBarInactiveTintColor: palette.textSecondary,
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: 'bold',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
        }}
      />
      <Tabs.Screen
        name="evidence"
        options={{
          title: 'Evidence',
        }}
      />
      <Tabs.Screen
        name="timeline"
        options={{
          title: 'Timeline',
        }}
      />
      <Tabs.Screen
        name="report"
        options={{
          title: 'Report',
        }}
      />
    </Tabs>
  );
}

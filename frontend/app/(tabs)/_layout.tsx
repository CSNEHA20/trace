import React from 'react';
import { Tabs } from 'expo-router';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          display: 'none', // Footer removed and completely migrated to collapsible sidebar drawer
        },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Workspace' }} />
      <Tabs.Screen name="evidence" options={{ title: 'Vault' }} />
      <Tabs.Screen name="timeline" options={{ title: 'Timeline' }} />
      <Tabs.Screen name="findings" options={{ title: 'Findings' }} />
      <Tabs.Screen name="integrity" options={{ title: 'Integrity' }} />
      <Tabs.Screen name="report" options={{ title: 'Report' }} />
    </Tabs>
  );
}

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { palette } from '../theme';

interface AppHeaderProps {
  title: string;
  subtitle?: string;
}

export function AppHeader({ title, subtitle }: AppHeaderProps) {
  return (
    <View style={styles.header}>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: palette.background,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: palette.primary,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 13,
    color: palette.textSecondary,
    marginTop: 2,
  },
});

import React from 'react';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { colors, typography } from '../theme';

interface LoadingSpinnerProps {
  label?: string;
  size?: 'small' | 'large';
  color?: string;
}

export function LoadingSpinner({ label, size = 'large', color = colors.primary }: LoadingSpinnerProps) {
  return (
    <View style={styles.container}>
      <ActivityIndicator size={size} color={color} />
      {label ? <Text style={styles.label}>{label}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    marginTop: 12,
    fontSize: 13,
    fontWeight: '500',
    color: colors.bodyMuted,
    letterSpacing: -0.1,
  },
});

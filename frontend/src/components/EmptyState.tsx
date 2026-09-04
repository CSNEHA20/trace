import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { palette } from '../theme';

interface EmptyStateProps {
  title: string;
  message: string;
}

export function EmptyState({ title, message }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: palette.text,
    marginBottom: 6,
  },
  message: {
    fontSize: 13,
    color: palette.textSecondary,
    textAlign: 'center',
  },
});

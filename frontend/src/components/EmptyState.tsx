import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, rounded, typography } from '../theme';

interface EmptyStateProps {
  title: string;
  message: string;
  icon?: keyof typeof Ionicons.glyphMap;
  actionText?: string;
  onAction?: () => void;
}

export function EmptyState({ title, message, icon = 'file-tray-outline', actionText, onAction }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <View style={styles.iconCircle}>
        <Ionicons name={icon} size={28} color={colors.primary} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 28,
    backgroundColor: colors.canvas,
    borderRadius: rounded.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 8,
    elevation: 1,
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: rounded.full,
    backgroundColor: colors.primarySubtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.ink,
    letterSpacing: -0.2,
    marginBottom: 6,
    textAlign: 'center',
  },
  message: {
    fontSize: 13,
    fontWeight: '400',
    color: colors.bodyMuted,
    textAlign: 'center',
    lineHeight: 19,
    letterSpacing: -0.1,
  },
});

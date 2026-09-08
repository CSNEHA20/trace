import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { CaseStatus } from '../types';
import { palette } from '../theme';

interface StatusBadgeProps {
  status: CaseStatus | 'VERIFIED' | 'TAMPERED';
}

export function StatusBadge({ status }: StatusBadgeProps) {
  let bgColor = palette.surfaceVariant;
  let textColor = palette.textSecondary;
  let borderColor = palette.border;

  switch (status) {
    case 'ACTIVE':
    case 'VERIFIED':
      bgColor = 'rgba(22, 163, 74, 0.12)';
      textColor = palette.success;
      borderColor = 'rgba(22, 163, 74, 0.35)';
      break;
    case 'TAMPERED':
      bgColor = 'rgba(220, 38, 38, 0.12)';
      textColor = palette.error;
      borderColor = 'rgba(220, 38, 38, 0.35)';
      break;
    case 'CLOSED':
      bgColor = 'rgba(107, 114, 128, 0.12)';
      textColor = palette.textSecondary;
      borderColor = 'rgba(107, 114, 128, 0.35)';
      break;
  }

  return (
    <View style={[styles.badge, { backgroundColor: bgColor, borderColor }]}>
      <Text style={[styles.badgeText, { color: textColor }]}>{status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
});


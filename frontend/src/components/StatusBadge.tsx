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

  switch (status) {
    case 'ACTIVE':
    case 'VERIFIED':
      bgColor = 'rgba(16, 185, 129, 0.15)';
      textColor = palette.success;
      break;
    case 'TAMPERED':
      bgColor = 'rgba(239, 68, 68, 0.15)';
      textColor = palette.error;
      break;
    case 'CLOSED':
      bgColor = 'rgba(148, 163, 184, 0.15)';
      textColor = palette.textSecondary;
      break;
  }

  return (
    <View style={[styles.badge, { backgroundColor: bgColor }]}>
      <Text style={[styles.badgeText, { color: textColor }]}>{status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});

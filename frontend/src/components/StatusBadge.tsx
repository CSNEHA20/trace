import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { CaseStatus } from '../types';
import { Colors, Radius, Typography } from '../theme';

interface StatusBadgeProps {
  status: CaseStatus | 'VERIFIED' | 'TAMPERED' | 'VALID' | 'ALERT' | 'PENDING';
}

export function StatusBadge({ status }: StatusBadgeProps) {
  let bgColor = Colors.surface;
  let textColor = Colors.textMuted;
  let borderColor = Colors.border;
  let dotColor = Colors.textMuted;

  switch (status) {
    case 'ACTIVE':
    case 'VERIFIED':
    case 'VALID':
      bgColor = 'rgba(5, 150, 105, 0.12)';
      textColor = Colors.emerald;
      borderColor = 'rgba(5, 150, 105, 0.35)';
      dotColor = Colors.emerald;
      break;
    case 'TAMPERED':
    case 'ALERT':
      bgColor = 'rgba(220, 38, 38, 0.12)';
      textColor = Colors.crimson;
      borderColor = 'rgba(220, 38, 38, 0.35)';
      dotColor = Colors.crimson;
      break;
    case 'PENDING':
      bgColor = 'rgba(217, 119, 6, 0.12)';
      textColor = Colors.amber;
      borderColor = 'rgba(217, 119, 6, 0.35)';
      dotColor = Colors.amber;
      break;
    case 'CLOSED':
      bgColor = 'rgba(134, 134, 139, 0.12)';
      textColor = Colors.textMuted;
      borderColor = Colors.border;
      dotColor = Colors.textMuted;
      break;
  }

  return (
    <View style={[styles.badge, { backgroundColor: bgColor, borderColor }]}>
      <View style={[styles.dot, { backgroundColor: dotColor }]} />
      <Text style={[styles.badgeText, { color: textColor }]}>{status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 3.5,
    borderRadius: Radius.full,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  badgeText: {
    ...Typography.subtopLabel,
    fontSize: 10,
  },
});

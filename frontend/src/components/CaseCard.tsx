import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Case } from '../types';
import { Colors, Radius, Typography, Shadows, Spacing } from '../theme';
import { StatusBadge } from './StatusBadge';
import { formatDate } from '../utils/crypto';

interface CaseCardProps {
  caseItem: Case;
  onPress: () => void;
}

export function CaseCard({ caseItem, onPress }: CaseCardProps) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.header}>
        <Text style={styles.caseNumber}>{caseItem.caseNumber}</Text>
        <StatusBadge status={caseItem.status} />
      </View>
      <Text style={styles.title}>{caseItem.title}</Text>
      {caseItem.description ? (
        <Text style={styles.description} numberOfLines={2}>
          {caseItem.description}
        </Text>
      ) : null}
      <View style={styles.footer}>
        <Text style={styles.investigator} numberOfLines={2}>{caseItem.investigatorName || 'Investigator'}</Text>
        <Text style={styles.date}>{formatDate(caseItem.createdAt)}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.lg,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
    ...Shadows.card,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  caseNumber: {
    ...Typography.mono,
    fontSize: 12,
    color: Colors.primary,
  },
  title: {
    ...Typography.headline,
    fontSize: 16,
    color: Colors.ink,
    marginBottom: 4,
  },
  description: {
    ...Typography.body,
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 12,
    lineHeight: 19,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  investigator: {
    ...Typography.bodyStrong,
    fontSize: 12,
    color: Colors.text,
    flex: 1,
    marginRight: 8,
  },
  date: {
    ...Typography.body,
    fontSize: 11,
    color: Colors.textMuted,
  },
});

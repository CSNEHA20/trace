import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Case } from '../types';
import { palette } from '../theme';
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
        <Text style={styles.investigator}>{caseItem.investigatorName}</Text>
        <Text style={styles.date}>{formatDate(caseItem.createdAt)}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: palette.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: palette.border,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  caseNumber: {
    fontSize: 13,
    fontWeight: '700',
    color: palette.secondary,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: palette.text,
    marginBottom: 4,
  },
  description: {
    fontSize: 13,
    color: palette.textSecondary,
    marginBottom: 12,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  investigator: {
    fontSize: 12,
    color: palette.textSecondary,
  },
  date: {
    fontSize: 11,
    color: palette.textSecondary,
  },
});

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
    borderLeftWidth: 4,
    borderLeftColor: palette.brandYellow,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  caseNumber: {
    fontSize: 12,
    fontWeight: '800',
    color: palette.deepBlack,
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: palette.text,
    marginBottom: 4,
  },
  description: {
    fontSize: 13,
    color: palette.textSecondary,
    marginBottom: 12,
    lineHeight: 18,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: palette.border,
  },
  investigator: {
    fontSize: 12,
    color: palette.textSecondary,
    fontWeight: '500',
  },
  date: {
    fontSize: 11,
    color: palette.textSecondary,
  },
});


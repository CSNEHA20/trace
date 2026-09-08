import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { EvidenceItem } from '../types';
import { palette } from '../theme';
import { formatHashShort, formatFileSize, formatDate } from '../utils/crypto';
import { StatusBadge } from './StatusBadge';

interface EvidenceCardProps {
  item: EvidenceItem;
  onPress: () => void;
}

export function EvidenceCard({ item, onPress }: EvidenceCardProps) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.header}>
        <Text style={styles.typeBadge}>{item.type}</Text>
        <StatusBadge status={item.isTampered ? 'TAMPERED' : 'VERIFIED'} />
      </View>

      <Text style={styles.title}>{item.title}</Text>
      <Text style={styles.hash}>SHA-256: {formatHashShort(item.sha256Hash, 10)}</Text>

      {item.aiAnalysis?.gemmaSummary ? (
        <View style={styles.aiBox}>
          <Text style={styles.aiLabel}>Gemma AI Analysis:</Text>
          <Text style={styles.aiText} numberOfLines={2}>
            {item.aiAnalysis.gemmaSummary}
          </Text>
        </View>
      ) : null}

      <View style={styles.footer}>
        <Text style={styles.meta}>{formatFileSize(item.fileSize)}</Text>
        <Text style={styles.meta}>{formatDate(item.timestamp)}</Text>
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
    elevation: 1,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  typeBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: palette.deepBlack,
    backgroundColor: palette.surfaceVariant,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: palette.borderDark,
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: palette.text,
    marginBottom: 4,
  },
  hash: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: palette.textSecondary,
    marginBottom: 8,
  },
  aiBox: {
    backgroundColor: palette.surfaceVariant,
    padding: 10,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: palette.border,
  },
  aiLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    color: palette.brandYellow,
    marginBottom: 2,
  },
  aiText: {
    fontSize: 12,
    color: palette.text,
    lineHeight: 17,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: palette.border,
    paddingTop: 8,
    marginTop: 4,
  },
  meta: {
    fontSize: 11,
    color: palette.textSecondary,
  },
});


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
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  typeBadge: {
    fontSize: 11,
    fontWeight: 'bold',
    color: palette.primary,
    backgroundColor: 'rgba(0, 242, 254, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  title: {
    fontSize: 15,
    fontWeight: 'bold',
    color: palette.text,
    marginBottom: 4,
  },
  hash: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: palette.textSecondary,
    marginBottom: 8,
  },
  aiBox: {
    backgroundColor: palette.surfaceVariant,
    padding: 8,
    borderRadius: 6,
    marginBottom: 8,
  },
  aiLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    color: palette.secondary,
    marginBottom: 2,
  },
  aiText: {
    fontSize: 12,
    color: palette.text,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  meta: {
    fontSize: 11,
    color: palette.textSecondary,
  },
});

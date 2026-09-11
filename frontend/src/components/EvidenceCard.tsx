import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { EvidenceItem } from '../types';
import { Colors, Radius, Typography, Shadows, Spacing } from '../theme';
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
        <View style={styles.typeBadge}>
          <Text style={styles.typeBadgeText}>{item.type}</Text>
        </View>
        <StatusBadge status={item.isTampered ? 'TAMPERED' : 'VERIFIED'} />
      </View>

      <Text style={styles.title}>{item.title || item.fileName}</Text>
      <Text style={styles.hash}>SHA-256: {formatHashShort(item.sha256Hash, 10)}</Text>

      {item.aiAnalysis?.gemmaSummary ? (
        <View style={styles.aiBox}>
          <Text style={styles.aiLabel}>Gemma AI Analysis</Text>
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
    marginBottom: 10,
  },
  typeBadge: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  typeBadgeText: {
    ...Typography.subtopLabel,
    fontSize: 10,
    color: Colors.ink,
  },
  title: {
    ...Typography.headline,
    fontSize: 15,
    color: Colors.ink,
    marginBottom: 4,
  },
  hash: {
    ...Typography.mono,
    fontSize: 11,
    color: Colors.textMuted,
    marginBottom: 8,
  },
  aiBox: {
    backgroundColor: Colors.primarySubtle,
    padding: 10,
    borderRadius: Radius.sm,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.primaryBorder,
  },
  aiLabel: {
    ...Typography.subtopHeading,
    fontSize: 11,
    color: Colors.primary,
    marginBottom: 2,
  },
  aiText: {
    ...Typography.body,
    fontSize: 12,
    color: Colors.ink,
    lineHeight: 18,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 8,
    marginTop: 4,
  },
  meta: {
    ...Typography.body,
    fontSize: 11,
    color: Colors.textMuted,
  },
});

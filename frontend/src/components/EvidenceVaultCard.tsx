import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { EvidenceItem } from '../types';
import { Colors, Radius, Typography, Shadows, Spacing } from '../theme';
import { formatHashShort, formatFileSize, formatDate } from '../utils/crypto';
import { EvidenceVaultThumbnail } from './EvidenceVaultThumbnail';

interface EvidenceVaultCardProps {
  item: EvidenceItem;
  onPress: () => void;
}

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string; border: string }> = {
  COMPLETE: { label: 'VERIFIED', color: Colors.emerald, bg: 'rgba(5, 150, 105, 0.12)', border: 'rgba(5, 150, 105, 0.35)' },
  FAILED: { label: 'FAILED', color: Colors.crimson, bg: 'rgba(220, 38, 38, 0.12)', border: 'rgba(220, 38, 38, 0.35)' },
  DUPLICATE: { label: 'DUPLICATE', color: Colors.amber, bg: 'rgba(217, 119, 6, 0.12)', border: 'rgba(217, 119, 6, 0.35)' },
  HASHING: { label: 'HASHING…', color: Colors.primary, bg: Colors.primarySubtle, border: Colors.primaryBorder },
  COPYING: { label: 'COPYING…', color: Colors.primary, bg: Colors.primarySubtle, border: Colors.primaryBorder },
  RECORDING: { label: 'RECORDING…', color: Colors.primary, bg: Colors.primarySubtle, border: Colors.primaryBorder },
  CANCELLED: { label: 'CANCELLED', color: Colors.textMuted, bg: Colors.canvasParchment, border: Colors.border },
  PENDING: { label: 'PENDING', color: Colors.amber, bg: 'rgba(217, 119, 6, 0.12)', border: 'rgba(217, 119, 6, 0.35)' },
  TAMPERED: { label: 'TAMPERED', color: Colors.crimson, bg: 'rgba(220, 38, 38, 0.14)', border: 'rgba(220, 38, 38, 0.4)' },
};

/**
 * Evidence Vault list card — 3-Tier Typography & High-Contrast Elevation
 */
export function EvidenceVaultCard({ item, onPress }: EvidenceVaultCardProps) {
  const statusKey = item.isTampered
    ? 'TAMPERED'
    : (item as any).ingestionStatus || 'COMPLETE';
  const statusInfo = STATUS_LABELS[statusKey] || STATUS_LABELS.COMPLETE;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      {/* Left: thumbnail */}
      <View style={styles.thumbContainer}>
        <EvidenceVaultThumbnail
          mediaType={item.type}
          fileUri={item.fileUri}
          ingestionStatus={(item as any).ingestionStatus || (item.isTampered ? 'FAILED' : 'COMPLETE')}
          size={56}
        />
      </View>

      {/* Right: metadata */}
      <View style={styles.meta}>
        <View style={styles.topRow}>
          <View style={styles.typePill}>
            <Text style={styles.typePillText}>{item.type}</Text>
          </View>
          <View style={[styles.statusPill, { backgroundColor: statusInfo.bg, borderColor: statusInfo.border }]}>
            <View style={[styles.statusDot, { backgroundColor: statusInfo.color }]} />
            <Text style={[styles.statusPillText, { color: statusInfo.color }]}>
              {statusInfo.label}
            </Text>
          </View>
        </View>

        {/* Filename */}
        <Text style={styles.filename} numberOfLines={1} ellipsizeMode="middle">
          {item.fileName}
        </Text>

        {/* SHA-256 hash */}
        <Text style={styles.hash} selectable>
          SHA-256: {formatHashShort(item.sha256Hash, 8)}
        </Text>

        {/* Footer: size + import time */}
        <View style={styles.footer}>
          <Text style={styles.footerMeta}>
            {item.fileSize > 0 ? formatFileSize(item.fileSize) : '—'}
          </Text>
          <Text style={styles.footerMeta}>{formatDate(item.timestamp)}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.lg,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: Colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    ...Shadows.card,
  },
  thumbContainer: {
    paddingTop: 1,
  },
  meta: {
    flex: 1,
    gap: 3,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  typePill: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  typePillText: {
    ...Typography.subtopLabel,
    fontSize: 9.5,
    color: Colors.text,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  statusPillText: {
    ...Typography.subtopLabel,
    fontSize: 9,
  },
  filename: {
    ...Typography.bodyStrong,
    fontSize: 14,
    color: Colors.text,
    letterSpacing: -0.2,
  },
  hash: {
    ...Typography.mono,
    fontSize: 11,
    color: Colors.textMuted,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 4,
  },
  footerMeta: {
    ...Typography.body,
    fontSize: 11,
    color: Colors.textMuted,
  },
});

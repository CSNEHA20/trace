import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { EvidenceItem } from '../types';
import { palette } from '../theme';
import { formatHashShort, formatFileSize, formatDate } from '../utils/crypto';
import { EvidenceVaultThumbnail } from './EvidenceVaultThumbnail';

interface EvidenceVaultCardProps {
  item: EvidenceItem;
  onPress: () => void;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  COMPLETE: { label: '✓ Verified', color: palette.success },
  FAILED: { label: '✗ Failed', color: palette.error },
  DUPLICATE: { label: '⧉ Duplicate', color: palette.warning },
  HASHING: { label: '⟳ Hashing…', color: palette.secondary },
  COPYING: { label: '⟳ Copying…', color: palette.secondary },
  RECORDING: { label: '⟳ Recording…', color: palette.primary },
  CANCELLED: { label: '✕ Cancelled', color: palette.textSecondary },
  PENDING: { label: '… Pending', color: palette.textSecondary },
  TAMPERED: { label: '⚠ TAMPERED', color: palette.error },
};

/**
 * Evidence Vault list card — shows:
 *   - Thumbnail (image preview or type icon) with status badge
 *   - Filename, type, import timestamp
 *   - SHA-256 hash (abbreviated)
 *   - Processing / hash status chip
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
          size={60}
        />
      </View>

      {/* Right: metadata */}
      <View style={styles.meta}>
        <View style={styles.topRow}>
          <View style={styles.typePill}>
            <Text style={styles.typePillText}>{item.type}</Text>
          </View>
          <View style={[styles.statusPill, { borderColor: statusInfo.color }]}>
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
    backgroundColor: palette.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: palette.border,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  thumbContainer: {
    paddingTop: 2,
  },
  meta: {
    flex: 1,
    gap: 4,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  typePill: {
    backgroundColor: 'rgba(0, 242, 254, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  typePillText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: palette.primary,
    letterSpacing: 0.5,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  filename: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.text,
  },
  hash: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: palette.textSecondary,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  footerMeta: {
    fontSize: 11,
    color: palette.textSecondary,
  },
});

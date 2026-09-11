import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { MediaCategory, IngestionStatus } from '../types';
import { colors, rounded, typography } from '../theme';

interface EvidenceVaultThumbnailProps {
  mediaType: MediaCategory;
  fileUri?: string;
  ingestionStatus?: IngestionStatus;
  size?: number;
}

/** Icon map for non-image media types */
const TYPE_ICONS: Record<MediaCategory, string> = {
  IMAGE: '🖼️',
  VIDEO: '🎬',
  AUDIO: '🎙️',
  DOCUMENT: '📄',
};

const STATUS_OVERLAY: Partial<Record<IngestionStatus, { icon: string; color: string }>> = {
  COMPLETE: { icon: '✓', color: colors.success },
  FAILED: { icon: '✗', color: colors.error },
  DUPLICATE: { icon: '⧉', color: colors.warning },
  HASHING: { icon: '⟳', color: colors.primary },
  COPYING: { icon: '⟳', color: colors.primary },
  RECORDING: { icon: '⟳', color: colors.primary },
  CANCELLED: { icon: '✕', color: colors.bodyMuted },
  PENDING: { icon: '…', color: colors.bodyMuted },
};

/**
 * Renders an Apple-styled thumbnail for any evidence type.
 * Features 1:1 square crop with rounded.sm (8px-12px) and subtle border.
 */
export function EvidenceVaultThumbnail({
  mediaType,
  fileUri,
  ingestionStatus,
  size = 56,
}: EvidenceVaultThumbnailProps) {
  const statusInfo = ingestionStatus ? STATUS_OVERLAY[ingestionStatus] : undefined;
  const radius = size * 0.2;

  return (
    <View style={[styles.container, { width: size, height: size, borderRadius: radius }]}>
      {mediaType === 'IMAGE' && fileUri && !fileUri.startsWith('clipboard://') ? (
        <Image
          source={{ uri: fileUri }}
          style={[styles.image, { width: size, height: size, borderRadius: radius }]}
          resizeMode="cover"
        />
      ) : (
        <View style={[styles.iconContainer, { width: size, height: size, borderRadius: radius }]}>
          <Text style={[styles.icon, { fontSize: size * 0.42 }]}>{TYPE_ICONS[mediaType]}</Text>
          <Text style={[styles.typeLabel, { fontSize: Math.max(size * 0.16, 9) }]}>{mediaType}</Text>
        </View>
      )}

      {statusInfo && (
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: statusInfo.color, width: size * 0.36, height: size * 0.36, borderRadius: size * 0.18 },
          ]}
        >
          <Text style={[styles.statusIcon, { fontSize: size * 0.18 }]}>{statusInfo.icon}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    overflow: 'visible',
  },
  image: {
    backgroundColor: colors.canvasParchment,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  iconContainer: {
    backgroundColor: colors.canvasParchment,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  icon: {
    lineHeight: undefined,
  },
  typeLabel: {
    color: colors.bodyMuted,
    fontWeight: '600',
    marginTop: 2,
    letterSpacing: 0.2,
  },
  statusBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.canvas,
    zIndex: 10,
  },
  statusIcon: {
    color: '#ffffff',
    fontWeight: '700',
    lineHeight: undefined,
  },
});

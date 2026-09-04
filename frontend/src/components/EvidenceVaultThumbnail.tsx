import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { MediaCategory, IngestionStatus } from '../types';
import { palette } from '../theme';

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
  COMPLETE: { icon: '✓', color: palette.success },
  FAILED: { icon: '✗', color: palette.error },
  DUPLICATE: { icon: '⧉', color: palette.warning },
  HASHING: { icon: '⟳', color: palette.secondary },
  COPYING: { icon: '⟳', color: palette.secondary },
  RECORDING: { icon: '⟳', color: palette.primary },
  CANCELLED: { icon: '✕', color: palette.textSecondary },
  PENDING: { icon: '…', color: palette.textSecondary },
};

/**
 * Renders a thumbnail for any evidence type.
 * For images: shows the actual image from the sandbox URI.
 * For other types: shows a type icon with the format label.
 * Overlays a status indicator badge on top-right corner.
 */
export function EvidenceVaultThumbnail({
  mediaType,
  fileUri,
  ingestionStatus,
  size = 56,
}: EvidenceVaultThumbnailProps) {
  const statusInfo = ingestionStatus ? STATUS_OVERLAY[ingestionStatus] : undefined;

  return (
    <View style={[styles.container, { width: size, height: size, borderRadius: size * 0.2 }]}>
      {mediaType === 'IMAGE' && fileUri && !fileUri.startsWith('clipboard://') ? (
        <Image
          source={{ uri: fileUri }}
          style={[styles.image, { width: size, height: size, borderRadius: size * 0.2 }]}
          resizeMode="cover"
        />
      ) : (
        <View style={[styles.iconContainer, { width: size, height: size, borderRadius: size * 0.2 }]}>
          <Text style={[styles.icon, { fontSize: size * 0.45 }]}>{TYPE_ICONS[mediaType]}</Text>
          <Text style={[styles.typeLabel, { fontSize: size * 0.17 }]}>{mediaType}</Text>
        </View>
      )}

      {statusInfo && (
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: statusInfo.color, width: size * 0.35, height: size * 0.35, borderRadius: size * 0.175 },
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
    backgroundColor: palette.surfaceVariant,
  },
  iconContainer: {
    backgroundColor: palette.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: palette.border,
  },
  icon: {
    lineHeight: undefined,
  },
  typeLabel: {
    color: palette.textSecondary,
    fontWeight: 'bold',
    marginTop: 2,
  },
  statusBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: palette.surface,
    zIndex: 10,
  },
  statusIcon: {
    color: '#fff',
    fontWeight: 'bold',
    lineHeight: undefined,
  },
});

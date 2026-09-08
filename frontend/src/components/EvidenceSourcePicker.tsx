import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { palette } from '../theme';
import { IngestionSource } from '../types';

// Lazy-load native modules for runtime safety and testability
function getDocumentPicker() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('expo-document-picker');
  } catch {
    return null;
  }
}

function getImagePicker() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('expo-image-picker');
  } catch {
    return null;
  }
}

function getClipboard() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('expo-clipboard');
  } catch {
    return null;
  }
}

function getFileSystem() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('expo-file-system');
  } catch {
    return null;
  }
}

/**
 * Computes UTF-8 byte length safely in React Native / Hermes without Node.js Buffer.
 */
function getUtf8ByteLength(str: string): number {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(str).length;
  }
  if (typeof Blob !== 'undefined') {
    return new Blob([str]).size;
  }
  let bytes = 0;
  for (let i = 0; i < str.length; i++) {
    const codePoint = str.charCodeAt(i);
    if (codePoint < 0x80) bytes += 1;
    else if (codePoint < 0x800) bytes += 2;
    else if (codePoint >= 0xd800 && codePoint <= 0xdbff) {
      bytes += 4;
      i++;
    } else bytes += 3;
  }
  return bytes;
}

export interface SourcePickerResult {
  uri: string;
  filename: string;
  mimeType?: string;
  fileSize?: number;
  source: IngestionSource;
  cancelled: boolean;
  permissionDenied?: boolean;
  error?: string;
}

interface EvidenceSourcePickerProps {
  visible: boolean;
  onClose: () => void;
  onSourceSelected: (result: SourcePickerResult) => void;
  isLoading?: boolean;
}

/**
 * Bottom-sheet UI that lets the investigator pick a real evidence source:
 * Camera | Gallery | Files | Clipboard
 *
 * ZERO mock fallback behavior:
 * Handles real permission requests, genuine cancellation, and surfaces real errors.
 */
export function EvidenceSourcePicker({
  visible,
  onClose,
  onSourceSelected,
  isLoading = false,
}: EvidenceSourcePickerProps) {
  const [picking, setPicking] = useState(false);

  const handleCancel = () => {
    if (picking) return;
    onClose();
    onSourceSelected({ uri: '', filename: '', source: 'FILES', cancelled: true });
  };

  // ── Camera ────────────────────────────────────────────────────────────
  const handleCamera = async () => {
    setPicking(true);
    try {
      const ImagePicker = getImagePicker();
      if (!ImagePicker) {
        onSourceSelected({
          uri: '',
          filename: '',
          source: 'CAMERA',
          cancelled: false,
          error: 'Image picker native module is not available on this device.',
        });
        return;
      }

      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        onSourceSelected({
          uri: '',
          filename: '',
          source: 'CAMERA',
          cancelled: false,
          permissionDenied: true,
          error: 'Camera permission denied',
        });
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions?.Images ?? 'Images',
        quality: 0.85,
        allowsEditing: false,
        exif: true,
      });

      setPicking(false);
      onClose();

      if (result.canceled) {
        onSourceSelected({ uri: '', filename: '', source: 'CAMERA', cancelled: true });
        return;
      }

      const asset = result.assets?.[0];
      if (!asset || !asset.uri) {
        onSourceSelected({ uri: '', filename: '', source: 'CAMERA', cancelled: true });
        return;
      }

      const filename = asset.fileName || `camera_${Date.now()}.jpg`;
      onSourceSelected({
        uri: asset.uri,
        filename,
        mimeType: asset.mimeType || 'image/jpeg',
        fileSize: asset.fileSize,
        source: 'CAMERA',
        cancelled: false,
      });
    } catch (err: unknown) {
      setPicking(false);
      onClose();
      onSourceSelected({
        uri: '',
        filename: '',
        source: 'CAMERA',
        cancelled: false,
        error: (err as Error)?.message || 'Camera capture failed',
      });
    }
  };

  // ── Gallery ───────────────────────────────────────────────────────────
  const handleGallery = async () => {
    setPicking(true);
    try {
      const ImagePicker = getImagePicker();
      if (!ImagePicker) {
        onSourceSelected({
          uri: '',
          filename: '',
          source: 'GALLERY',
          cancelled: false,
          error: 'Image picker native module is not available on this device.',
        });
        return;
      }

      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        onSourceSelected({
          uri: '',
          filename: '',
          source: 'GALLERY',
          cancelled: false,
          permissionDenied: true,
          error: 'Gallery permission denied',
        });
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions?.All ?? 'All',
        quality: 0.85,
        allowsEditing: false,
        allowsMultipleSelection: false,
        exif: true,
      });

      setPicking(false);
      onClose();

      if (result.canceled) {
        onSourceSelected({ uri: '', filename: '', source: 'GALLERY', cancelled: true });
        return;
      }

      const asset = result.assets?.[0];
      if (!asset || !asset.uri) {
        onSourceSelected({ uri: '', filename: '', source: 'GALLERY', cancelled: true });
        return;
      }

      const isVideo = asset.type === 'video' || (asset.mimeType && asset.mimeType.startsWith('video/'));
      const defaultExt = isVideo ? 'mp4' : 'jpg';
      const filename = asset.fileName || `gallery_${Date.now()}.${defaultExt}`;
      onSourceSelected({
        uri: asset.uri,
        filename,
        mimeType: asset.mimeType || (isVideo ? 'video/mp4' : 'image/jpeg'),
        fileSize: asset.fileSize,
        source: 'GALLERY',
        cancelled: false,
      });
    } catch (err: unknown) {
      setPicking(false);
      onClose();
      onSourceSelected({
        uri: '',
        filename: '',
        source: 'GALLERY',
        cancelled: false,
        error: (err as Error)?.message || 'Gallery picker failed',
      });
    }
  };

  // ── Files ─────────────────────────────────────────────────────────────
  const handleFiles = async () => {
    setPicking(true);
    try {
      const DocPicker = getDocumentPicker();
      if (!DocPicker) {
        setPicking(false);
        onClose();
        onSourceSelected({
          uri: '',
          filename: '',
          source: 'FILES',
          cancelled: false,
          error: 'Document picker native module is not available on this device.',
        });
        return;
      }

      const result = await DocPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
        multiple: false,
      });

      setPicking(false);
      onClose();

      if (result.canceled) {
        onSourceSelected({ uri: '', filename: '', source: 'FILES', cancelled: true });
        return;
      }

      const asset = result.assets?.[0] ?? result;
      if (!asset || !asset.uri) {
        onSourceSelected({ uri: '', filename: '', source: 'FILES', cancelled: true });
        return;
      }

      onSourceSelected({
        uri: asset.uri,
        filename: asset.name || `document_${Date.now()}`,
        mimeType: asset.mimeType || undefined,
        fileSize: asset.size,
        source: 'FILES',
        cancelled: false,
      });
    } catch (err: unknown) {
      setPicking(false);
      onClose();
      onSourceSelected({
        uri: '',
        filename: '',
        source: 'FILES',
        cancelled: false,
        error: (err as Error)?.message || 'File picker failed',
      });
    }
  };

  // ── Clipboard ─────────────────────────────────────────────────────────
  const handleClipboard = async () => {
    setPicking(true);
    try {
      const Clipboard = getClipboard();
      if (!Clipboard) {
        onSourceSelected({
          uri: '',
          filename: '',
          source: 'CLIPBOARD',
          cancelled: false,
          error: 'Clipboard native module is not available on this device.',
        });
        return;
      }

      const text = await Clipboard.getStringAsync();
      if (!text || text.trim().length === 0) {
        Alert.alert('Clipboard Empty', 'No text found in clipboard to import.');
        onSourceSelected({ uri: '', filename: '', source: 'CLIPBOARD', cancelled: true });
        return;
      }

      const FileSystem = getFileSystem();
      const clipFilename = `clipboard_${Date.now()}.txt`;
      let fileUri: string;

      if (FileSystem && FileSystem.cacheDirectory) {
        fileUri = `${FileSystem.cacheDirectory}${clipFilename}`;
        await FileSystem.writeAsStringAsync(fileUri, text, { encoding: 'utf8' });
      } else {
        onSourceSelected({
          uri: '',
          filename: '',
          source: 'CLIPBOARD',
          cancelled: false,
          error: 'Cannot save clipboard evidence: File system is not available.',
        });
        return;
      }

      const byteLength = getUtf8ByteLength(text);

      setPicking(false);
      onClose();

      onSourceSelected({
        uri: fileUri,
        filename: clipFilename,
        mimeType: 'text/plain',
        fileSize: byteLength,
        source: 'CLIPBOARD',
        cancelled: false,
      });
    } catch (err: unknown) {
      setPicking(false);
      onClose();
      onSourceSelected({
        uri: '',
        filename: '',
        source: 'CLIPBOARD',
        cancelled: false,
        error: (err as Error)?.message || 'Clipboard extraction failed',
      });
    }
  };

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleCancel}
    >
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={handleCancel} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <Text style={styles.title}>Add Evidence</Text>
        <Text style={styles.subtitle}>Select a source to import genuine evidence</Text>

        {(isLoading || picking) ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={palette.primary} size="large" />
            <Text style={styles.loadingText}>Opening source...</Text>
          </View>
        ) : (
          <View style={styles.optionGrid}>
            <TouchableOpacity style={styles.optionBtn} onPress={handleCamera} activeOpacity={0.8}>
              <Text style={styles.optionIcon}>📷</Text>
              <Text style={styles.optionLabel}>Camera</Text>
              <Text style={styles.optionHint}>Capture photo</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.optionBtn} onPress={handleGallery} activeOpacity={0.8}>
              <Text style={styles.optionIcon}>🖼️</Text>
              <Text style={styles.optionLabel}>Gallery</Text>
              <Text style={styles.optionHint}>Choose media</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.optionBtn} onPress={handleFiles} activeOpacity={0.8}>
              <Text style={styles.optionIcon}>📁</Text>
              <Text style={styles.optionLabel}>Files</Text>
              <Text style={styles.optionHint}>PDF / Doc / Audio</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.optionBtn} onPress={handleClipboard} activeOpacity={0.8}>
              <Text style={styles.optionIcon}>📋</Text>
              <Text style={styles.optionLabel}>Clipboard</Text>
              <Text style={styles.optionHint}>Paste text</Text>
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    backgroundColor: palette.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingBottom: 36,
    paddingTop: 12,
    borderTopWidth: 1,
    borderColor: palette.border,
    elevation: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: palette.borderDark,
    alignSelf: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: palette.text,
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: palette.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  optionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 20,
  },
  optionBtn: {
    width: '47%',
    backgroundColor: palette.surfaceVariant,
    borderRadius: 14,
    padding: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: palette.border,
  },
  optionIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  optionLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: palette.text,
    marginBottom: 2,
  },
  optionHint: {
    fontSize: 11,
    color: palette.textSecondary,
    textAlign: 'center',
  },
  loadingRow: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  loadingText: {
    color: palette.textSecondary,
    fontSize: 14,
  },
  cancelBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: 'center',
    backgroundColor: palette.surface,
  },
  cancelText: {
    fontSize: 15,
    color: palette.error,
    fontWeight: '600',
  },
});


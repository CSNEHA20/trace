import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { palette } from '../theme';
import { IngestionSource } from '../types';

// Lazy-load native modules for testability
function getDocumentPicker() {
  try {
    return require('expo-document-picker');
  } catch {
    return null;
  }
}

function getImagePicker() {
  try {
    return require('expo-image-picker');
  } catch {
    return null;
  }
}

function getCamera() {
  try {
    return require('expo-camera');
  } catch {
    return null;
  }
}

function getClipboard() {
  try {
    return require('expo-clipboard');
  } catch {
    return null;
  }
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
 * Bottom-sheet UI that lets the investigator pick an evidence source:
 * Camera | Gallery | Files | Clipboard
 *
 * Handles permission requests, cancellation, and unsupported source gracefully.
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
      const CameraModule = getCamera();
      if (!CameraModule) {
        return _mockSource('CAMERA');
      }

      const { status } = await CameraModule.Camera.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        onSourceSelected({
          uri: '', filename: '', source: 'CAMERA', cancelled: false,
          permissionDenied: true, error: 'Camera permission denied',
        });
        return;
      }

      const result = await CameraModule.launchCameraAsync({
        mediaTypes: CameraModule.MediaTypeOptions?.Images ?? 'Images',
        quality: 0.92,
        allowsEditing: false,
      });

      if (result.canceled) {
        onSourceSelected({ uri: '', filename: '', source: 'CAMERA', cancelled: true });
        return;
      }

      const asset = result.assets?.[0];
      if (!asset) {
        onSourceSelected({ uri: '', filename: '', source: 'CAMERA', cancelled: true });
        return;
      }

      const filename = asset.fileName || `capture_${Date.now()}.jpg`;
      onSourceSelected({
        uri: asset.uri,
        filename,
        mimeType: asset.mimeType || 'image/jpeg',
        fileSize: asset.fileSize,
        source: 'CAMERA',
        cancelled: false,
      });
    } catch (err: unknown) {
      onSourceSelected({
        uri: '', filename: '', source: 'CAMERA', cancelled: false,
        error: (err as Error)?.message || 'Camera error',
      });
    } finally {
      setPicking(false);
      onClose();
    }
  };

  // ── Gallery ───────────────────────────────────────────────────────────
  const handleGallery = async () => {
    setPicking(true);
    try {
      const Picker = getImagePicker();
      if (!Picker) {
        return _mockSource('GALLERY');
      }

      const { status } = await Picker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        onSourceSelected({
          uri: '', filename: '', source: 'GALLERY', cancelled: false,
          permissionDenied: true, error: 'Gallery permission denied',
        });
        return;
      }

      const result = await Picker.launchImageLibraryAsync({
        mediaTypes: Picker.MediaTypeOptions?.All ?? 'All',
        quality: 1,
        allowsEditing: false,
        allowsMultipleSelection: false,
      });

      if (result.canceled) {
        onSourceSelected({ uri: '', filename: '', source: 'GALLERY', cancelled: true });
        return;
      }

      const asset = result.assets?.[0];
      if (!asset) {
        onSourceSelected({ uri: '', filename: '', source: 'GALLERY', cancelled: true });
        return;
      }

      const filename = asset.fileName || `gallery_${Date.now()}.jpg`;
      onSourceSelected({
        uri: asset.uri,
        filename,
        mimeType: asset.mimeType || 'image/jpeg',
        fileSize: asset.fileSize,
        source: 'GALLERY',
        cancelled: false,
      });
    } catch (err: unknown) {
      onSourceSelected({
        uri: '', filename: '', source: 'GALLERY', cancelled: false,
        error: (err as Error)?.message || 'Gallery error',
      });
    } finally {
      setPicking(false);
      onClose();
    }
  };

  // ── Files ─────────────────────────────────────────────────────────────
  const handleFiles = async () => {
    setPicking(true);
    try {
      const DocPicker = getDocumentPicker();
      if (!DocPicker) {
        return _mockSource('FILES');
      }

      const result = await DocPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: false,
        multiple: false,
      });

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
      onSourceSelected({
        uri: '', filename: '', source: 'FILES', cancelled: false,
        error: (err as Error)?.message || 'File picker error',
      });
    } finally {
      setPicking(false);
      onClose();
    }
  };

  // ── Clipboard ─────────────────────────────────────────────────────────
  const handleClipboard = async () => {
    setPicking(true);
    try {
      const Clipboard = getClipboard();
      let text: string | null = null;

      if (Clipboard) {
        text = await Clipboard.getStringAsync();
      }

      if (!text || text.trim().length === 0) {
        Alert.alert('Clipboard Empty', 'No text found in clipboard to import.');
        onSourceSelected({ uri: '', filename: '', source: 'CLIPBOARD', cancelled: true });
        return;
      }

      // Clipboard text → write to a temp URI representation
      // The ingestion service will receive the text as the URI and handle it as a .txt doc
      const clipFilename = `clipboard_${Date.now()}.txt`;

      // Write clipboard content to sandbox via a data URI convention
      onSourceSelected({
        uri: `clipboard://text?data=${encodeURIComponent(text)}`,
        filename: clipFilename,
        mimeType: 'text/plain',
        fileSize: text.length,
        source: 'CLIPBOARD',
        cancelled: false,
      });
    } catch (err: unknown) {
      onSourceSelected({
        uri: '', filename: '', source: 'CLIPBOARD', cancelled: false,
        error: (err as Error)?.message || 'Clipboard error',
      });
    } finally {
      setPicking(false);
      onClose();
    }
  };

  // ── Mock (test / Expo Go fallback) ────────────────────────────────────
  const _mockSource = (src: IngestionSource) => {
    const ext = src === 'CAMERA' ? 'jpg' : src === 'GALLERY' ? 'jpg' : 'pdf';
    onSourceSelected({
      uri: `file:///mock/${src.toLowerCase()}_${Date.now()}.${ext}`,
      filename: `${src.toLowerCase()}_${Date.now()}.${ext}`,
      mimeType: src === 'CAMERA' || src === 'GALLERY' ? 'image/jpeg' : 'application/pdf',
      fileSize: 1024 * 1024,
      source: src,
      cancelled: false,
    });
    setPicking(false);
    onClose();
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
        <Text style={styles.subtitle}>Select a source to import evidence</Text>

        {(isLoading || picking) ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={palette.primary} size="large" />
            <Text style={styles.loadingText}>Processing...</Text>
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
    backgroundColor: 'rgba(0,0,0,0.6)',
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
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: palette.border,
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
    backgroundColor: palette.card,
  },
  cancelText: {
    fontSize: 15,
    color: palette.error,
    fontWeight: '600',
  },
});

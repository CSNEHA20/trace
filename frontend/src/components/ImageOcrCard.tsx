import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { palette } from '../theme';
import { OcrStatus, OcrResult } from '../types';

interface ImageOcrCardProps {
  evidenceId: string;
  fileUri: string;
  existingOcrText?: string;
  status: OcrStatus;
  result: OcrResult | null;
  onStartOcr: () => void;
}

export function ImageOcrCard({
  existingOcrText,
  status,
  result,
  onStartOcr,
}: ImageOcrCardProps) {
  const isProcessing = status === 'VALIDATING' || status === 'PROCESSING';
  const displayStatus = status === 'IDLE' && existingOcrText ? 'COMPLETED' : status;
  const currentText = result?.text !== undefined ? result.text : existingOcrText;
  const hasText = currentText && currentText.trim().length > 0;
  const hasRun = displayStatus === 'COMPLETED' || displayStatus === 'FAILED';
  const isEngineUnavailable = displayStatus === 'FAILED' && result?.errorCode === 'ENGINE_UNAVAILABLE';

  const getStatusColor = () => {
    if (isEngineUnavailable) {
      return palette.brandYellow;
    }
    switch (displayStatus) {
      case 'COMPLETED':
        return palette.success;
      case 'FAILED':
        return palette.error;
      case 'PROCESSING':
      case 'VALIDATING':
        return palette.brandYellow;
      default:
        return palette.textSecondary;
    }
  };

  const getStatusLabel = () => {
    if (isEngineUnavailable) {
      return 'NATIVE ENGINE REQ';
    }
    return displayStatus;
  };

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>On-Device OCR (ML Kit)</Text>
          <Text style={styles.subtitle}>Latin Text Recognition • 100% Offline</Text>
        </View>
        <View style={[styles.statusBadge, { borderColor: getStatusColor() }]}>
          <Text style={[styles.statusText, { color: getStatusColor() }]}>
            {getStatusLabel()}
          </Text>
        </View>
      </View>

      {isProcessing ? (
        <View style={styles.processingContainer}>
          <ActivityIndicator size="small" color={palette.brandYellow} />
          <Text style={styles.processingText}>
            {status === 'VALIDATING' ? 'Validating image integrity...' : 'Recognizing text on-device...'}
          </Text>
        </View>
      ) : null}

      {displayStatus === 'FAILED' && result?.error ? (
        isEngineUnavailable ? (
          <View style={styles.unavailableBox}>
            <Text style={styles.unavailableTitle}>⚡ Native ML Kit Engine Notice</Text>
            <Text style={styles.unavailableMsg}>
              Google ML Kit Latin text recognition requires a custom native build. Preserved file integrity (SHA-256) and source metadata intake are verified and intact.
            </Text>
          </View>
        ) : (
          <View style={styles.errorBox}>
            <Text style={styles.errorLabel}>OCR Error [{result.errorCode || 'FAILED'}]:</Text>
            <Text style={styles.errorMsg}>{result.error}</Text>
          </View>
        )
      ) : null}

      {displayStatus === 'COMPLETED' ? (
        <View style={styles.resultContainer}>
          {hasText ? (
            <View style={styles.textBox}>
              <Text style={styles.textLabel}>Recognized Text:</Text>
              <Text style={styles.recognizedText} selectable>{currentText}</Text>
            </View>
          ) : (
            <View style={styles.emptyTextBox}>
              <Text style={styles.emptyTextTitle}>Scan Complete</Text>
              <Text style={styles.emptyTextDescription}>
                No readable text was detected in this image.
              </Text>
            </View>
          )}

          {result?.processingTimeMs !== undefined && (
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Processing Time:</Text>
              <Text style={styles.metaValue}>{Math.round(result.processingTimeMs)} ms</Text>
            </View>
          )}

          {result?.imageWidth && result?.imageHeight ? (
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Dimensions:</Text>
              <Text style={styles.metaValue}>{result.imageWidth} × {result.imageHeight} px</Text>
            </View>
          ) : null}

          {result?.engine ? (
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Engine:</Text>
              <Text style={styles.metaValue}>{result.engine}</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      <TouchableOpacity
        style={[styles.actionBtn, isProcessing && styles.actionBtnDisabled]}
        onPress={onStartOcr}
        disabled={isProcessing}
        activeOpacity={0.8}
      >
        <Text style={styles.actionBtnText}>
          {hasRun ? 'Re-run On-Device OCR' : 'Extract Text with ML Kit'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: palette.card,
    borderRadius: 10,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: palette.border,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  title: {
    fontSize: 15,
    fontWeight: 'bold',
    color: palette.primary,
  },
  subtitle: {
    fontSize: 11,
    color: palette.secondary,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  processingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
    padding: 12,
    borderRadius: 6,
    marginVertical: 8,
  },
  processingText: {
    marginLeft: 10,
    fontSize: 13,
    color: palette.text,
  },
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderWidth: 1,
    padding: 10,
    borderRadius: 6,
    marginVertical: 8,
  },
  errorLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: palette.error || '#EF4444',
  },
  errorMsg: {
    fontSize: 12,
    color: palette.text,
    marginTop: 2,
  },
  unavailableBox: {
    backgroundColor: '#FEF3C7',
    borderColor: palette.brandYellow,
    borderWidth: 1,
    borderLeftWidth: 4,
    padding: 12,
    borderRadius: 6,
    marginVertical: 8,
  },
  unavailableTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#92400E',
    marginBottom: 4,
  },
  unavailableMsg: {
    fontSize: 12,
    color: '#78350F',
    lineHeight: 16,
  },
  resultContainer: {
    marginVertical: 8,
  },
  textBox: {
    backgroundColor: palette.surfaceVariant,
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: palette.border,
  },
  textLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    color: palette.brandYellow,
    marginBottom: 4,
  },
  recognizedText: {
    fontSize: 13,
    lineHeight: 18,
    color: palette.text,
    fontFamily: 'monospace',
  },
  emptyTextBox: {
    backgroundColor: palette.surfaceVariant,
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: palette.border,
  },
  emptyTextTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: palette.text,
  },
  emptyTextDescription: {
    fontSize: 12,
    color: palette.textSecondary,
    marginTop: 2,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  metaLabel: {
    fontSize: 11,
    color: palette.textSecondary,
  },
  metaValue: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: palette.text,
  },
  actionBtn: {
    backgroundColor: palette.primary,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  actionBtnDisabled: {
    opacity: 0.5,
  },
  actionBtnText: {
    color: palette.white,
    fontWeight: 'bold',
    fontSize: 13,
  },
});


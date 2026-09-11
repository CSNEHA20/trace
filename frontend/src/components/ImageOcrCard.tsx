import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { colors, rounded, typography } from '../theme';
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

  const getStatusColor = () => {
    switch (displayStatus) {
      case 'COMPLETED':
        return colors.success;
      case 'FAILED':
        return colors.error;
      case 'PROCESSING':
      case 'VALIDATING':
        return colors.primary;
      default:
        return colors.bodyMuted;
    }
  };

  const getStatusBg = () => {
    switch (displayStatus) {
      case 'COMPLETED':
        return colors.successBg;
      case 'FAILED':
        return colors.errorBg;
      case 'PROCESSING':
      case 'VALIDATING':
        return colors.primarySubtle;
      default:
        return colors.canvasParchment;
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>On-Device Text Recognition</Text>
          <Text style={styles.subtitle}>Latin OCR Engine · 100% Offline</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusBg(), borderColor: getStatusColor() }]}>
          <Text style={[styles.statusText, { color: getStatusColor() }]}>
            {displayStatus}
          </Text>
        </View>
      </View>

      {isProcessing ? (
        <View style={styles.processingContainer}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.processingText}>
            {status === 'VALIDATING' ? 'Validating image integrity…' : 'Recognizing text on-device…'}
          </Text>
        </View>
      ) : null}

      {displayStatus === 'FAILED' && result?.error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorLabel}>OCR Error [{result.errorCode || 'FAILED'}]:</Text>
          <Text style={styles.errorMsg}>{result.error}</Text>
        </View>
      ) : null}

      {displayStatus === 'COMPLETED' ? (
        <View style={styles.resultContainer}>
          {hasText ? (
            <View style={styles.textBox}>
              <Text style={styles.textLabel}>RECOGNIZED TEXT</Text>
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
    backgroundColor: colors.canvas,
    borderRadius: rounded.lg,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.hairline,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 1,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.ink,
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 12,
    color: colors.bodyMuted,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: rounded.pill,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  processingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primarySubtle,
    padding: 12,
    borderRadius: rounded.sm,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
  },
  processingText: {
    marginLeft: 10,
    fontSize: 13,
    color: colors.ink,
    fontWeight: '500',
  },
  errorBox: {
    backgroundColor: colors.errorBg,
    borderColor: colors.errorBorder,
    borderWidth: 1,
    padding: 10,
    borderRadius: rounded.sm,
    marginVertical: 8,
  },
  errorLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.error,
  },
  errorMsg: {
    fontSize: 12,
    color: colors.ink,
    marginTop: 2,
  },
  resultContainer: {
    marginVertical: 8,
  },
  textBox: {
    backgroundColor: colors.canvasParchment,
    padding: 12,
    borderRadius: rounded.sm,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  textLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.bodyMuted,
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  recognizedText: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.ink,
    fontFamily: 'monospace',
  },
  emptyTextBox: {
    backgroundColor: colors.canvasParchment,
    padding: 12,
    borderRadius: rounded.sm,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  emptyTextTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.ink,
  },
  emptyTextDescription: {
    fontSize: 12,
    color: colors.bodyMuted,
    marginTop: 2,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  metaLabel: {
    fontSize: 11,
    color: colors.bodyMuted,
  },
  metaValue: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: colors.ink,
  },
  actionBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: rounded.pill,
    alignItems: 'center',
    marginTop: 8,
  },
  actionBtnDisabled: {
    opacity: 0.5,
  },
  actionBtnText: {
    color: colors.white,
    fontWeight: '600',
    fontSize: 13,
    letterSpacing: 0.1,
  },
});

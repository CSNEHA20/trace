import React from 'react';
import { View, Text, StyleSheet, Modal, ActivityIndicator } from 'react-native';
import { IngestionStatus } from '../types';
import { palette } from '../theme';

interface IngestionProgressOverlayProps {
  visible: boolean;
  status: IngestionStatus | null;
  filename?: string;
  statusMessage?: string;
}

const STATUS_MESSAGES: Record<IngestionStatus, string> = {
  PENDING: 'Preparing forensic intake…',
  SELECTING: 'Selecting source media…',
  COPYING: 'Copying to private storage…',
  VALIDATING: 'Validating format & integrity…',
  HASHING: 'Computing SHA-256 digest…',
  EXTRACTING_METADATA: 'Extracting EXIF & metadata…',
  PROCESSING_EXTRACT: 'Running on-device extraction (OCR / Audio)…',
  RECORDING: 'Writing SQLite record & hash chain…',
  COMPLETE: 'Evidence Preserved & Locked ✓',
  FAILED: 'Preservation Failed',
  DUPLICATE: 'Duplicate Evidence Detected',
  CANCELLED: 'Intake Cancelled',
};

const STATUS_STEPS: IngestionStatus[] = [
  'COPYING',
  'VALIDATING',
  'HASHING',
  'EXTRACTING_METADATA',
  'PROCESSING_EXTRACT',
  'RECORDING',
  'COMPLETE',
];

const STEP_LABELS: Record<string, string> = {
  COPYING: 'COPY',
  VALIDATING: 'CHECK',
  HASHING: 'HASH',
  EXTRACTING_METADATA: 'EXIF',
  PROCESSING_EXTRACT: 'EXTRACT',
  RECORDING: 'LEDGER',
  COMPLETE: 'LOCKED',
};

function stepIndex(status: IngestionStatus | null): number {
  if (!status) return -1;
  return STATUS_STEPS.indexOf(status);
}

/**
 * Full-screen transparent overlay shown during evidence ingestion.
 * Displays real pipeline stage progress and filename being preserved.
 */
export function IngestionProgressOverlay({
  visible,
  status,
  filename,
  statusMessage,
}: IngestionProgressOverlayProps) {
  const isTerminal =
    status === 'COMPLETE' || status === 'FAILED' || status === 'DUPLICATE' || status === 'CANCELLED';
  const currentStep = stepIndex(status);

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.bannerHeader}>FORENSIC PRESERVATION WORKFLOW</Text>

          {!isTerminal && (
            <ActivityIndicator color={palette.primary} size="large" style={styles.spinner} />
          )}

          {status === 'COMPLETE' && (
            <Text style={[styles.terminalIcon, { color: palette.success }]}>✓</Text>
          )}
          {status === 'FAILED' && (
            <Text style={[styles.terminalIcon, { color: palette.error }]}>✗</Text>
          )}
          {status === 'DUPLICATE' && (
            <Text style={[styles.terminalIcon, { color: palette.warning }]}>⧉</Text>
          )}
          {status === 'CANCELLED' && (
            <Text style={[styles.terminalIcon, { color: palette.textSecondary }]}>✕</Text>
          )}

          <Text style={styles.statusText}>
            {statusMessage || (status ? STATUS_MESSAGES[status] : 'Initialising…')}
          </Text>

          {filename ? (
            <Text style={styles.filename} numberOfLines={2} ellipsizeMode="middle">
              {filename}
            </Text>
          ) : null}

          {/* Stage Progress Spine */}
          <View style={styles.stepsContainer}>
            {STATUS_STEPS.map((step, i) => {
              const isActive = i === currentStep;
              const isDone = i < currentStep || status === 'COMPLETE';

              return (
                <View key={step} style={styles.stepRow}>
                  <View
                    style={[
                      styles.stepDot,
                      isDone
                        ? { backgroundColor: palette.success, borderColor: palette.success }
                        : isActive
                        ? { backgroundColor: palette.primary, borderColor: palette.primary }
                        : { backgroundColor: palette.surfaceVariant, borderColor: palette.border },
                    ]}
                  />
                  <Text
                    style={[
                      styles.stepLabel,
                      isDone
                        ? { color: palette.success, fontWeight: 'bold' }
                        : isActive
                        ? { color: palette.primary, fontWeight: 'bold' }
                        : { color: palette.textSecondary },
                    ]}
                  >
                    {STEP_LABELS[step] || step}
                  </Text>
                  {isDone && <Text style={styles.stepCheck}>✓</Text>}
                </View>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(9, 13, 22, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: palette.surface,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: palette.border,
    gap: 10,
  },
  bannerHeader: {
    fontSize: 10,
    fontWeight: 'bold',
    color: palette.secondary,
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  spinner: {
    marginVertical: 4,
  },
  terminalIcon: {
    fontSize: 40,
    fontWeight: 'bold',
    marginVertical: 2,
  },
  statusText: {
    fontSize: 15,
    fontWeight: 'bold',
    color: palette.text,
    textAlign: 'center',
  },
  filename: {
    fontSize: 11,
    color: palette.textSecondary,
    textAlign: 'center',
    fontFamily: 'monospace',
    marginBottom: 6,
  },
  stepsContainer: {
    width: '100%',
    backgroundColor: palette.surfaceVariant,
    borderRadius: 10,
    padding: 12,
    marginTop: 6,
    gap: 8,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stepDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
  },
  stepLabel: {
    fontSize: 11,
    flex: 1,
  },
  stepCheck: {
    fontSize: 11,
    color: palette.success,
    fontWeight: 'bold',
  },
});

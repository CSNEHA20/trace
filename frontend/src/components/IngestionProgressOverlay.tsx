import React from 'react';
import { View, Text, StyleSheet, Modal, ActivityIndicator } from 'react-native';
import { IngestionStatus } from '../types';
import { colors, rounded, typography } from '../theme';

interface IngestionProgressOverlayProps {
  visible: boolean;
  status: IngestionStatus | null;
  filename?: string;
  fileName?: string;
  statusMessage?: string;
}

const STATUS_MESSAGES: Record<IngestionStatus, string> = {
  PENDING: 'Preparing forensic intake…',
  SELECTING: 'Selecting source media…',
  COPYING: 'Preserving in secure storage…',
  VALIDATING: 'Validating format & integrity…',
  HASHING: 'Computing SHA-256 digest…',
  EXTRACTING_METADATA: 'Extracting EXIF & metadata…',
  PROCESSING_EXTRACT: 'Extracting forensic content…',
  RECORDING: 'Locking into cryptographic ledger…',
  COMPLETE: 'Evidence Preserved & Locked',
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
  COPYING: 'Preserve',
  VALIDATING: 'Validate',
  HASHING: 'SHA-256',
  EXTRACTING_METADATA: 'EXIF Metadata',
  PROCESSING_EXTRACT: 'Extract Content',
  RECORDING: 'Ledger Node',
  COMPLETE: 'Cryptographically Sealed',
};

function stepIndex(status: IngestionStatus | null): number {
  if (!status) return -1;
  return STATUS_STEPS.indexOf(status);
}

/**
 * Full-screen overlay shown during evidence ingestion.
 * Apple-style frosted modal with real pipeline progression.
 */
export function IngestionProgressOverlay({
  visible,
  status,
  filename,
  fileName,
  statusMessage,
}: IngestionProgressOverlayProps) {
  const displayFilename = filename || fileName;
  const isTerminal =
    status === 'COMPLETE' || status === 'FAILED' || status === 'DUPLICATE' || status === 'CANCELLED';
  const currentStep = stepIndex(status);

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.bannerHeader}>FORENSIC INTAKE & PRESERVATION</Text>

          {!isTerminal && (
            <ActivityIndicator color={colors.primary} size="large" style={styles.spinner} />
          )}

          {status === 'COMPLETE' && (
            <View style={[styles.terminalBadge, { backgroundColor: colors.successBg }]}>
              <Text style={[styles.terminalIcon, { color: colors.success }]}>✓</Text>
            </View>
          )}
          {status === 'FAILED' && (
            <View style={[styles.terminalBadge, { backgroundColor: colors.errorBg }]}>
              <Text style={[styles.terminalIcon, { color: colors.error }]}>✗</Text>
            </View>
          )}
          {status === 'DUPLICATE' && (
            <View style={[styles.terminalBadge, { backgroundColor: colors.warningBg }]}>
              <Text style={[styles.terminalIcon, { color: colors.warning }]}>⧉</Text>
            </View>
          )}
          {status === 'CANCELLED' && (
            <View style={[styles.terminalBadge, { backgroundColor: colors.canvasParchment }]}>
              <Text style={[styles.terminalIcon, { color: colors.bodyMuted }]}>✕</Text>
            </View>
          )}

          <Text style={styles.statusText}>
            {statusMessage || (status ? STATUS_MESSAGES[status] : 'Initialising…')}
          </Text>

          {displayFilename ? (
            <Text style={styles.filename} numberOfLines={2} ellipsizeMode="middle">
              {displayFilename}
            </Text>
          ) : null}

          {/* Stage Progress Container */}
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
                        ? { backgroundColor: colors.success, borderColor: colors.success }
                        : isActive
                        ? { backgroundColor: colors.primary, borderColor: colors.primary }
                        : { backgroundColor: colors.canvas, borderColor: colors.hairline },
                    ]}
                  />
                  <Text
                    style={[
                      styles.stepLabel,
                      isDone
                        ? { color: colors.success, fontWeight: '600' }
                        : isActive
                        ? { color: colors.primary, fontWeight: '600' }
                        : { color: colors.bodyMuted },
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
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: colors.canvas,
    borderRadius: rounded.xl,
    padding: 24,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.hairline,
    gap: 8,
    elevation: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
  },
  bannerHeader: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.primary,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  spinner: {
    marginVertical: 6,
  },
  terminalBadge: {
    width: 52,
    height: 52,
    borderRadius: rounded.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 4,
  },
  terminalIcon: {
    fontSize: 26,
    fontWeight: '700',
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.ink,
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  filename: {
    fontSize: 12,
    color: colors.bodyMuted,
    textAlign: 'center',
    fontFamily: 'monospace',
    marginBottom: 8,
  },
  stepsContainer: {
    width: '100%',
    backgroundColor: colors.canvasParchment,
    borderRadius: rounded.lg,
    padding: 14,
    marginTop: 4,
    gap: 10,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1.5,
  },
  stepLabel: {
    fontSize: 12,
    flex: 1,
    letterSpacing: -0.1,
  },
  stepCheck: {
    fontSize: 11,
    color: colors.success,
    fontWeight: '700',
  },
});

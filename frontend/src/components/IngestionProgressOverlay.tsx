import React from 'react';
import { View, Text, StyleSheet, Modal, ActivityIndicator } from 'react-native';
import { IngestionStatus } from '../types';
import { palette } from '../theme';

interface IngestionProgressOverlayProps {
  visible: boolean;
  status: IngestionStatus | null;
  filename?: string;
}

const STATUS_MESSAGES: Record<IngestionStatus, string> = {
  PENDING: 'Preparing import…',
  COPYING: 'Copying file to secure vault…',
  HASHING: 'Computing SHA-256 hash…',
  RECORDING: 'Writing evidence record…',
  COMPLETE: 'Import complete ✓',
  FAILED: 'Import failed',
  DUPLICATE: 'Duplicate detected',
  CANCELLED: 'Import cancelled',
};

const STATUS_STEPS: IngestionStatus[] = ['COPYING', 'HASHING', 'RECORDING', 'COMPLETE'];

function stepIndex(status: IngestionStatus | null): number {
  if (!status) return -1;
  return STATUS_STEPS.indexOf(status);
}

/**
 * Full-screen transparent overlay shown during evidence ingestion.
 * Displays pipeline step progress (Copying → Hashing → Recording → Complete)
 * and the filename being processed.
 */
export function IngestionProgressOverlay({
  visible,
  status,
  filename,
}: IngestionProgressOverlayProps) {
  const isTerminal = status === 'COMPLETE' || status === 'FAILED' || status === 'DUPLICATE' || status === 'CANCELLED';
  const currentStep = stepIndex(status);

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={styles.card}>
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
            {status ? STATUS_MESSAGES[status] : 'Initialising…'}
          </Text>

          {filename ? (
            <Text style={styles.filename} numberOfLines={2} ellipsizeMode="middle">
              {filename}
            </Text>
          ) : null}

          {/* Step progress bar */}
          <View style={styles.stepsRow}>
            {STATUS_STEPS.map((step, i) => (
              <View key={step} style={styles.stepItem}>
                <View
                  style={[
                    styles.stepDot,
                    i <= currentStep
                      ? { backgroundColor: palette.primary }
                      : { backgroundColor: palette.border },
                  ]}
                />
                {i < STATUS_STEPS.length - 1 && (
                  <View
                    style={[
                      styles.stepLine,
                      i < currentStep
                        ? { backgroundColor: palette.primary }
                        : { backgroundColor: palette.border },
                    ]}
                  />
                )}
                <Text style={[styles.stepLabel, i <= currentStep ? { color: palette.primary } : {}]}>
                  {step === 'RECORDING' ? 'RECORD' : step}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(9, 13, 22, 0.88)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: palette.surface,
    borderRadius: 20,
    padding: 32,
    width: 320,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: palette.border,
    gap: 12,
  },
  spinner: {
    marginBottom: 4,
  },
  terminalIcon: {
    fontSize: 48,
    fontWeight: 'bold',
  },
  statusText: {
    fontSize: 17,
    fontWeight: '600',
    color: palette.text,
    textAlign: 'center',
  },
  filename: {
    fontSize: 12,
    color: palette.textSecondary,
    textAlign: 'center',
    fontFamily: 'monospace',
  },
  stepsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  stepItem: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  stepDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  stepLine: {
    width: 36,
    height: 2,
  },
  stepLabel: {
    position: 'absolute',
    top: 14,
    fontSize: 9,
    color: palette.textSecondary,
    fontWeight: 'bold',
    letterSpacing: 0.3,
    left: -8,
    width: 54,
    textAlign: 'center',
  },
});

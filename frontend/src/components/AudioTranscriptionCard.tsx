import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { ProgressBar } from 'react-native-paper';
import { TranscriptionStatus, TranscriptionErrorCode, TranscriptionResult } from '../types';
import { colors, rounded, typography } from '../theme';
import { Ionicons } from '@expo/vector-icons';

export interface AudioTranscriptionCardProps {
  evidenceId: string;
  fileUri: string;
  existingTranscription?: string;
  status: TranscriptionStatus;
  progressPercent: number;
  statusMessage?: string;
  result?: TranscriptionResult | null;
  onStartTranscription: () => void;
  onCancelTranscription?: () => void;
}

export const AudioTranscriptionCard: React.FC<AudioTranscriptionCardProps> = ({
  evidenceId,
  fileUri,
  existingTranscription,
  status,
  progressPercent,
  statusMessage,
  result,
  onStartTranscription,
  onCancelTranscription,
}) => {
  const [copied, setCopied] = useState(false);

  const getStatusColor = (st: TranscriptionStatus) => {
    switch (st) {
      case 'COMPLETED':
        return colors.success;
      case 'PROCESSING':
      case 'LOADING_MODEL':
        return colors.primary;
      case 'FAILED':
        return colors.error;
      case 'CANCELLED':
        return colors.warning;
      default:
        return colors.bodyMuted;
    }
  };

  const getStatusBg = (st: TranscriptionStatus) => {
    switch (st) {
      case 'COMPLETED':
        return colors.successBg;
      case 'PROCESSING':
      case 'LOADING_MODEL':
        return colors.primarySubtle;
      case 'FAILED':
        return colors.errorBg;
      case 'CANCELLED':
        return colors.warningBg;
      default:
        return colors.canvasParchment;
    }
  };

  const formatErrorCode = (code?: TranscriptionErrorCode) => {
    switch (code) {
      case 'SILENCE_DETECTED':
        return 'Silence Detected (< -40dB threshold)';
      case 'POOR_QUALITY':
        return 'Poor Quality Audio / High Noise Floor';
      case 'UNSUPPORTED_CODEC':
        return 'Unsupported Audio Codec';
      case 'LONG_RECORDING':
        return 'Long Recording Segmented (> 10 mins)';
      case 'CANCELLED':
        return 'Transcription Cancelled by User';
      case 'TRANSCRIPTION_FAILED':
        return 'Whisper.cpp Engine Decoding Failure';
      default:
        return 'Transcription Error';
    }
  };

  const transcriptText = result?.text || existingTranscription;

  const handleCopy = () => {
    if (transcriptText) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <View style={styles.card} testID="audio-transcription-card">
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={styles.titleContainer}>
          <Text style={styles.titleText}>On-Device Audio Transcription</Text>
          <Text style={styles.subtitleText}>Whisper GGML Local Model · 100% Offline</Text>
        </View>
        <View
          style={[
            styles.statusChip,
            { backgroundColor: getStatusBg(status), borderColor: getStatusColor(status) },
          ]}
          testID="transcription-status-chip"
        >
          <Text style={[styles.statusChipText, { color: getStatusColor(status) }]}>
            {status}
          </Text>
        </View>
      </View>

      {/* Progress Bar View */}
      {(status === 'PROCESSING' || status === 'LOADING_MODEL') && (
        <View style={styles.progressSection} testID="transcription-progress-view">
          <View style={styles.progressLabelRow}>
            <Text style={styles.progressStatusText}>
              {statusMessage || (status === 'LOADING_MODEL' ? 'Loading GGML Model…' : 'Transcribing speech…')}
            </Text>
            <Text style={styles.progressPercentText}>{Math.round(progressPercent)}%</Text>
          </View>
          <ProgressBar
            progress={progressPercent / 100}
            color={colors.primary}
            style={styles.progressBar}
          />
          {onCancelTranscription && (
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={onCancelTranscription}
              testID="cancel-transcription-btn"
            >
              <Text style={styles.cancelBtnText}>Cancel Process</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Completed / Existing Transcript View */}
      {transcriptText && status !== 'PROCESSING' && status !== 'LOADING_MODEL' && (
        <View style={styles.resultContainer} testID="transcription-result-view">
          <Text style={styles.resultHeader}>TRANSCRIPT PREVIEW</Text>
          <View style={styles.transcriptBox}>
            <Text style={styles.transcriptText} selectable>{transcriptText}</Text>
          </View>

          {result?.processingHash && (
            <View style={styles.hashBadge}>
              <Text style={styles.hashLabel}>Processing Hash (SHA-256):</Text>
              <Text style={styles.hashValue} numberOfLines={1}>
                {result.processingHash}
              </Text>
            </View>
          )}

          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.copyBtn}
              onPress={handleCopy}
              activeOpacity={0.8}
              testID="copy-transcript-btn"
            >
              <Ionicons name={copied ? "checkmark" : "copy-outline"} size={14} color={colors.primary} />
              <Text style={styles.copyBtnText}>{copied ? 'Copied' : 'Copy Text'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.retranscribeBtn}
              onPress={onStartTranscription}
              activeOpacity={0.7}
              testID="retranscribe-btn"
            >
              <Text style={styles.retranscribeBtnText}>Re-transcribe</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Error State View */}
      {status === 'FAILED' && (
        <View style={styles.errorContainer} testID="transcription-error-view">
          <Text style={styles.errorTitle}>
            {formatErrorCode(result?.errorCode)}
          </Text>
          <Text style={styles.errorText}>
            {result?.error || 'Audio transcription failed. Check file format or acoustic quality.'}
          </Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={onStartTranscription}
            testID="retry-transcription-btn"
          >
            <Text style={styles.retryBtnText}>Retry Local Transcription</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Cancelled View */}
      {status === 'CANCELLED' && (
        <View style={styles.cancelledContainer} testID="transcription-cancelled-view">
          <Text style={styles.cancelledText}>Transcription process was cancelled.</Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={onStartTranscription}
            testID="restart-transcription-btn"
          >
            <Text style={styles.retryBtnText}>Start Transcription</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Idle View */}
      {status === 'IDLE' && !transcriptText && (
        <View style={styles.idleContainer} testID="transcription-idle-view">
          <Text style={styles.idleText}>
            No transcript generated yet. Run local Whisper speech-to-text on this sandbox audio file.
          </Text>
          <TouchableOpacity
            style={styles.startBtn}
            onPress={onStartTranscription}
            activeOpacity={0.8}
            testID="start-transcription-btn"
          >
            <Ionicons name="mic-outline" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.startBtnText}>Start Local Whisper AI</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    marginVertical: 8,
    borderRadius: rounded.lg,
    backgroundColor: colors.canvas,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: 16,
    elevation: 1,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  titleContainer: {
    flex: 1,
  },
  titleText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.ink,
    letterSpacing: -0.2,
  },
  subtitleText: {
    fontSize: 12,
    color: colors.bodyMuted,
    marginTop: 2,
  },
  statusChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: rounded.pill,
    borderWidth: 1,
  },
  statusChipText: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  progressSection: {
    marginVertical: 8,
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  progressStatusText: {
    fontSize: 12,
    color: colors.bodyMuted,
  },
  progressPercentText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.canvasParchment,
  },
  cancelBtn: {
    alignSelf: 'flex-end',
    marginTop: 8,
  },
  cancelBtnText: {
    fontSize: 12,
    color: colors.error,
    fontWeight: '500',
  },
  resultContainer: {
    marginTop: 4,
  },
  resultHeader: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.bodyMuted,
    letterSpacing: 0.4,
    marginBottom: 6,
  },
  transcriptBox: {
    backgroundColor: colors.canvasParchment,
    padding: 12,
    borderRadius: rounded.sm,
    borderWidth: 1,
    borderColor: colors.hairline,
    marginBottom: 8,
  },
  transcriptText: {
    fontSize: 13,
    color: colors.ink,
    lineHeight: 19,
  },
  hashBadge: {
    marginBottom: 10,
  },
  hashLabel: {
    fontSize: 10,
    color: colors.bodyMuted,
  },
  hashValue: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: colors.success,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: rounded.pill,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surfacePearl,
  },
  copyBtnText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.primary,
  },
  retranscribeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  retranscribeBtnText: {
    fontSize: 12,
    color: colors.bodyMuted,
    fontWeight: '500',
  },
  errorContainer: {
    backgroundColor: colors.errorBg,
    padding: 12,
    borderRadius: rounded.sm,
    marginTop: 4,
    borderWidth: 1,
    borderColor: colors.errorBorder,
  },
  errorTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.error,
    marginBottom: 4,
  },
  errorText: {
    fontSize: 12,
    color: colors.ink,
    marginBottom: 10,
  },
  cancelledContainer: {
    backgroundColor: colors.warningBg,
    borderRadius: rounded.sm,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.warningBorder,
  },
  cancelledText: {
    fontSize: 12,
    color: colors.ink,
    marginBottom: 8,
  },
  idleContainer: {
    paddingVertical: 4,
  },
  idleText: {
    fontSize: 13,
    color: colors.bodyMuted,
    lineHeight: 18,
    marginBottom: 12,
  },
  startBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: rounded.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  startBtnText: {
    color: colors.white,
    fontWeight: '600',
    fontSize: 13,
  },
  retryBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 10,
    borderRadius: rounded.pill,
    alignItems: 'center',
  },
  retryBtnText: {
    color: colors.white,
    fontWeight: '600',
    fontSize: 12,
  },
});

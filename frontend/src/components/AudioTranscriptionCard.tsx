import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Card, Button, ProgressBar, Chip, useTheme } from 'react-native-paper';
import { TranscriptionStatus, TranscriptionErrorCode, TranscriptionResult } from '../types';
import { palette } from '../theme';

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
  const theme = useTheme();
  const [copied, setCopied] = useState(false);

  const getStatusColor = (st: TranscriptionStatus) => {
    switch (st) {
      case 'COMPLETED':
        return palette.success; // Build Green
      case 'PROCESSING':
      case 'LOADING_MODEL':
        return palette.brandYellow; // iQOO Brand Yellow
      case 'FAILED':
        return palette.error; // Restriction Red
      case 'CANCELLED':
        return palette.brandYellow;
      default:
        return palette.textSecondary;
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
    <Card style={styles.card} testID="audio-transcription-card">
      <Card.Content>
        {/* Header */}
        <View style={styles.headerRow}>
          <View style={styles.titleContainer}>
            <Text style={styles.titleText}>Whisper.cpp Local Transcription</Text>
            <Text style={styles.subtitleText}>On-Device GGML Tiny Model (~39MB)</Text>
          </View>
          <Chip
            style={[styles.statusChip, { backgroundColor: getStatusColor(status) + '20' }]}
            textStyle={{ color: getStatusColor(status), fontSize: 11, fontWeight: 'bold' }}
            testID="transcription-status-chip"
          >
            {status}
          </Chip>
        </View>

        {/* Progress Bar View */}
        {(status === 'PROCESSING' || status === 'LOADING_MODEL') && (
          <View style={styles.progressSection} testID="transcription-progress-view">
            <View style={styles.progressLabelRow}>
              <Text style={styles.progressStatusText}>
                {statusMessage || (status === 'LOADING_MODEL' ? 'Loading GGML Model...' : 'Transcribing speech...')}
              </Text>
              <Text style={styles.progressPercentText}>{Math.round(progressPercent)}%</Text>
            </View>
            <ProgressBar
              progress={progressPercent / 100}
              color={palette.brandYellow}
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

        {/* Completed View */}
        {status === 'COMPLETED' && transcriptText && (
          <View style={styles.resultContainer} testID="transcription-result-view">
            <Text style={styles.resultHeader}>Transcript Preview:</Text>
            <View style={styles.transcriptBox}>
              <Text style={styles.transcriptText}>{transcriptText}</Text>
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
              <Button
                mode="outlined"
                onPress={handleCopy}
                icon={copied ? 'check' : 'content-copy'}
                compact
                style={styles.actionBtn}
                testID="copy-transcript-btn"
              >
                {copied ? 'Copied' : 'Copy Text'}
              </Button>
              <Button
                mode="text"
                onPress={onStartTranscription}
                compact
                testID="retranscribe-btn"
              >
                Re-transcribe
              </Button>
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
            <Button
              mode="contained"
              buttonColor={palette.error}
              textColor={palette.white}
              onPress={onStartTranscription}
              style={styles.retryBtn}
              testID="retry-transcription-btn"
            >
              Retry Local Transcription
            </Button>
          </View>
        )}

        {/* Cancelled View */}
        {status === 'CANCELLED' && (
          <View style={styles.cancelledContainer} testID="transcription-cancelled-view">
            <Text style={styles.cancelledText}>Transcription process was cancelled.</Text>
            <Button
              mode="outlined"
              onPress={onStartTranscription}
              style={styles.retryBtn}
              testID="restart-transcription-btn"
            >
              Start Transcription
            </Button>
          </View>
        )}

        {/* Idle View */}
        {status === 'IDLE' && !transcriptText && (
          <View style={styles.idleContainer} testID="transcription-idle-view">
            <Text style={styles.idleText}>
              No transcript generated yet. Run local Whisper speech-to-text on this sandbox audio file.
            </Text>
            <Button
              mode="contained"
              onPress={onStartTranscription}
              icon="microphone"
              style={styles.startBtn}
              testID="start-transcription-btn"
            >
              Start Local Whisper AI
            </Button>
          </View>
        )}
      </Card.Content>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    marginVertical: 8,
    borderRadius: 12,
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.border,
    elevation: 1,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
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
    fontWeight: 'bold',
    color: palette.text,
  },
  subtitleText: {
    fontSize: 11,
    color: palette.textSecondary,
    marginTop: 2,
  },
  statusChip: {
    height: 24,
  },
  progressSection: {
    marginVertical: 8,
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  progressStatusText: {
    fontSize: 12,
    color: palette.textSecondary,
  },
  progressPercentText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: palette.brandYellow,
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    backgroundColor: palette.border,
  },
  cancelBtn: {
    alignSelf: 'flex-end',
    marginTop: 8,
  },
  cancelBtnText: {
    fontSize: 12,
    color: palette.error,
  },
  resultContainer: {
    marginTop: 4,
  },
  resultHeader: {
    fontSize: 12,
    fontWeight: '600',
    color: palette.textSecondary,
    marginBottom: 4,
  },
  transcriptBox: {
    backgroundColor: palette.surfaceVariant,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.border,
    marginBottom: 8,
  },
  transcriptText: {
    fontSize: 13,
    color: palette.text,
    lineHeight: 18,
  },
  hashBadge: {
    marginBottom: 8,
  },
  hashLabel: {
    fontSize: 10,
    color: palette.textSecondary,
  },
  hashValue: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: palette.success,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  actionBtn: {
    borderColor: palette.border,
  },
  errorContainer: {
    backgroundColor: palette.errorBg,
    padding: 12,
    borderRadius: 8,
    marginTop: 4,
    borderWidth: 1,
    borderColor: 'rgba(220, 38, 38, 0.3)',
  },
  errorTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: palette.error,
    marginBottom: 4,
  },
  errorText: {
    fontSize: 12,
    color: '#991B1B',
    marginBottom: 8,
  },
  cancelledContainer: {
    backgroundColor: palette.warningBg,
    borderRadius: 8,
    padding: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(245, 166, 35, 0.3)',
  },
  cancelledText: {
    fontSize: 12,
    color: '#B45309',
    marginBottom: 8,
  },
  idleContainer: {
    paddingVertical: 4,
  },
  idleText: {
    fontSize: 12,
    color: palette.textSecondary,
    marginBottom: 10,
  },
  startBtn: {
    backgroundColor: palette.primary,
  },
  retryBtn: {
    marginTop: 4,
  },
});


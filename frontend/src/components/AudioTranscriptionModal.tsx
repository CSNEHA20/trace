import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal } from 'react-native';
import { Button, SegmentedButtons, useTheme } from 'react-native-paper';
import { AudioTranscriptionCard } from './AudioTranscriptionCard';
import { whisperService } from '../services/whisperService';
import { TranscriptionStatus, TranscriptionResult, WhisperModelType } from '../types';
import { palette } from '../theme';

export interface AudioTranscriptionModalProps {
  visible: boolean;
  evidenceId: string;
  sandboxUri: string;
  existingTranscription?: string;
  onClose: () => void;
  onTranscriptionComplete?: (result: TranscriptionResult) => void;
}

export const AudioTranscriptionModal: React.FC<AudioTranscriptionModalProps> = ({
  visible,
  evidenceId,
  sandboxUri,
  existingTranscription,
  onClose,
  onTranscriptionComplete,
}) => {
  const theme = useTheme();
  const [selectedModel, setSelectedModel] = useState<WhisperModelType>('tiny');
  const [status, setStatus] = useState<TranscriptionStatus>('IDLE');
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [result, setResult] = useState<TranscriptionResult | null>(null);
  const [cancelSignal, setCancelSignal] = useState<{ isCancelled: boolean }>({ isCancelled: false });

  const handleStart = async () => {
    setStatus('LOADING_MODEL');
    setProgressPercent(5);
    setStatusMessage('Initializing Whisper.cpp engine...');
    setResult(null);

    const signal = { isCancelled: false };
    setCancelSignal(signal);

    try {
      const res = await whisperService.transcribeAudio(evidenceId, sandboxUri, {
        model: selectedModel,
        language: 'en',
        cancellationSignal: signal,
        onProgress: (pct, msg) => {
          if (!signal.isCancelled) {
            setProgressPercent(pct);
            setStatusMessage(msg);
            if (pct >= 20 && pct < 80) {
              setStatus('PROCESSING');
            }
          }
        },
      });

      if (signal.isCancelled || res.status === 'CANCELLED') {
        setStatus('CANCELLED');
        setResult(res);
      } else if (res.status === 'COMPLETED') {
        setStatus('COMPLETED');
        setResult(res);
        if (onTranscriptionComplete) {
          onTranscriptionComplete(res);
        }
      } else {
        setStatus('FAILED');
        setResult(res);
      }
    } catch (err: unknown) {
      const errorMsg = (err as Error)?.message || 'Unexpected transcription error';
      setStatus('FAILED');
      setResult({
        status: 'FAILED',
        error: errorMsg,
        errorCode: 'UNKNOWN',
      });
    }
  };

  const handleCancel = () => {
    cancelSignal.isCancelled = true;
    setStatus('CANCELLED');
    setStatusMessage('Cancelled by user');
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
      testID="audio-transcription-modal"
    >
      <View style={styles.overlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Local Audio Transcription</Text>
          <Text style={styles.modalSubtitle}>
            Whisper.cpp On-Device Inference • 100% Confidential
          </Text>

          <View style={styles.modelPickerContainer}>
            <Text style={styles.pickerLabel}>Select Quantized Whisper Model:</Text>
            <SegmentedButtons
              value={selectedModel}
              onValueChange={(val) => setSelectedModel(val as WhisperModelType)}
              buttons={[
                { value: 'tiny', label: 'Tiny (~39MB)' },
                { value: 'base', label: 'Base (~142MB)' },
              ]}
              style={styles.segmentedBtn}
            />
          </View>

          <AudioTranscriptionCard
            evidenceId={evidenceId}
            fileUri={sandboxUri}
            existingTranscription={existingTranscription}
            status={status}
            progressPercent={progressPercent}
            statusMessage={statusMessage}
            result={result}
            onStartTranscription={handleStart}
            onCancelTranscription={handleCancel}
          />

          <Button mode="outlined" onPress={onClose} style={styles.closeBtn} testID="close-transcription-modal-btn">
            Close Modal
          </Button>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: palette.surface,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: palette.border,
    elevation: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: palette.text,
  },
  modalSubtitle: {
    fontSize: 12,
    color: palette.textSecondary,
    marginBottom: 16,
  },
  modelPickerContainer: {
    marginBottom: 12,
  },
  pickerLabel: {
    fontSize: 12,
    color: palette.textSecondary,
    marginBottom: 6,
  },
  segmentedBtn: {
    backgroundColor: palette.surfaceVariant,
  },
  closeBtn: {
    marginTop: 12,
    borderColor: palette.border,
  },
});


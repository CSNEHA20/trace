import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useEvidenceStore } from '../store/evidenceStore';
import { AppHeader } from '../components/AppHeader';
import { AudioTranscriptionCard } from '../components/AudioTranscriptionCard';
import { ImageOcrCard } from '../components/ImageOcrCard';
import { ForensicAnalysisCard } from '../components/ForensicAnalysisCard';
import { whisperService } from '../services/whisperService';
import { ocrService } from '../services/ocrService';
import { palette } from '../theme';
import { useLocalSearchParams } from 'expo-router';
import { formatDate, formatFileSize } from '../utils/crypto';
import { TranscriptionStatus, TranscriptionResult, OcrStatus, OcrResult } from '../types';

export function EvidenceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const item = useEvidenceStore((state) => state.evidenceList.find((e) => e.id === id) || state.selectedEvidence);
  const fetchEvidence = useEvidenceStore((state) => state.fetchEvidence);

  const [transcribeStatus, setTranscribeStatus] = useState<TranscriptionStatus>('IDLE');
  const [progressPercent, setProgressPercent] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [transcribeResult, setTranscribeResult] = useState<TranscriptionResult | null>(null);
  const [cancelSignal, setCancelSignal] = useState<{ isCancelled: boolean }>({ isCancelled: false });

  // Step 4 OCR State
  const [ocrStatus, setOcrStatus] = useState<OcrStatus>('IDLE');
  const [ocrResult, setOcrResult] = useState<OcrResult | null>(null);

  if (!item) {
    return (
      <View style={styles.container}>
        <AppHeader title="Evidence Item" />
        <Text style={styles.errText}>Evidence item not found.</Text>
      </View>
    );
  }

  const handleStartOcr = async () => {
    setOcrStatus('VALIDATING');
    try {
      const res = await ocrService.processEvidenceOcr(
        item.id,
        item.fileUri,
        item.type,
        {
          onStatusUpdate: (s) => setOcrStatus(s),
        }
      );
      setOcrResult(res);
      setOcrStatus(res.status);
      if (res.status === 'COMPLETED') {
        await fetchEvidence(item.caseId);
      }
    } catch (err: unknown) {
      setOcrStatus('FAILED');
      setOcrResult({
        status: 'FAILED',
        error: (err as Error)?.message || 'OCR extraction failed',
        errorCode: 'UNKNOWN',
      });
    }
  };

  const handleStartTranscription = async () => {
    setTranscribeStatus('LOADING_MODEL');
    setProgressPercent(5);
    setStatusMessage('Loading Whisper GGML model...');
    const signal = { isCancelled: false };
    setCancelSignal(signal);

    try {
      const res = await whisperService.transcribeAudio(item.id, item.fileUri, {
        model: 'tiny',
        language: 'en',
        cancellationSignal: signal,
        onProgress: (pct, msg) => {
          if (!signal.isCancelled) {
            setProgressPercent(pct);
            setStatusMessage(msg);
            if (pct >= 20 && pct < 80) {
              setTranscribeStatus('PROCESSING');
            }
          }
        },
      });

      if (signal.isCancelled || res.status === 'CANCELLED') {
        setTranscribeStatus('CANCELLED');
        setTranscribeResult(res);
      } else if (res.status === 'COMPLETED') {
        setTranscribeStatus('COMPLETED');
        setTranscribeResult(res);
        await fetchEvidence(item.caseId);
      } else {
        setTranscribeStatus('FAILED');
        setTranscribeResult(res);
      }
    } catch (err: unknown) {
      setTranscribeStatus('FAILED');
      setTranscribeResult({
        status: 'FAILED',
        error: (err as Error)?.message || 'Transcription error',
        errorCode: 'UNKNOWN',
      });
    }
  };

  const handleCancelTranscription = () => {
    cancelSignal.isCancelled = true;
    setTranscribeStatus('CANCELLED');
    setStatusMessage('Cancelled by user');
  };

  return (
    <View style={styles.container}>
      <AppHeader title={item.title} subtitle={`ID: ${item.id.substring(0, 12)}… · ${item.type}`} />
      <ScrollView contentContainerStyle={styles.content}>
        
        {/* ── SECTION 1: SOURCE EVIDENCE & METADATA ── */}
        <View style={styles.sectionBadgeRow}>
          <Text style={styles.sectionBadgeText}>SOURCE EVIDENCE (AUTHORITATIVE)</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Source Metadata & Provenance</Text>
          <Text style={styles.metaLine}><Text style={styles.boldText}>Filename: </Text>{item.fileName}</Text>
          <Text style={styles.metaLine}><Text style={styles.boldText}>Media Type: </Text>{item.type} ({item.mimeType})</Text>
          <Text style={styles.metaLine}><Text style={styles.boldText}>File Size: </Text>{formatFileSize(item.fileSize)}</Text>
          <Text style={styles.metaLine}>
            <Text style={styles.boldText}>Timestamp: </Text>
            {item.exifData?.dateTimeOriginal 
              ? `${item.exifData.dateTimeOriginal} (PROVENANCE: EXIF Verified)`
              : `${formatDate(item.timestamp)} (PROVENANCE: Ingested)`}
          </Text>
          <Text style={styles.metaLine}><Text style={styles.boldText}>File URI: </Text>{item.fileUri}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Cryptographic Proof</Text>
          <Text style={styles.monoLabel}>SHA-256 Digest:</Text>
          <Text style={styles.monoVal} selectable>{item.sha256Hash}</Text>
          {item.signature ? (
            <>
              <Text style={styles.monoLabel}>Hardware Signature:</Text>
              <Text style={styles.monoVal} selectable>{item.signature}</Text>
            </>
          ) : null}
        </View>

        {item.exifData ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>EXIF Embedded Metadata</Text>
            {item.exifData.make || item.exifData.model ? (
              <Text style={styles.metaLine}>Device: {item.exifData.make} {item.exifData.model}</Text>
            ) : null}
            {item.exifData.dateTimeOriginal ? (
              <Text style={styles.metaLine}>Capture Time: {item.exifData.dateTimeOriginal}</Text>
            ) : null}
            {item.exifData.gpsLatitude && item.exifData.gpsLongitude ? (
              <Text style={styles.metaLine}>GPS Coordinates: {item.exifData.gpsLatitude}, {item.exifData.gpsLongitude}</Text>
            ) : null}
          </View>
        ) : null}

        {/* ── SECTION 2: EXTRACTED CONTENT (OCR / WHISPER) ── */}
        <View style={styles.sectionBadgeRow}>
          <Text style={styles.sectionBadgeText}>EXTRACTED CONTENT (DETERMINISTIC)</Text>
        </View>

        {item.type === 'IMAGE' && (
          <ImageOcrCard
            evidenceId={item.id}
            fileUri={item.fileUri}
            existingOcrText={item.aiAnalysis?.detectedText?.join('\n')}
            status={ocrStatus}
            result={ocrResult}
            onStartOcr={handleStartOcr}
          />
        )}

        {item.type === 'AUDIO' && (
          <AudioTranscriptionCard
            evidenceId={item.id}
            fileUri={item.fileUri}
            existingTranscription={item.aiAnalysis?.transcription}
            status={transcribeStatus}
            progressPercent={progressPercent}
            statusMessage={statusMessage}
            result={transcribeResult}
            onStartTranscription={handleStartTranscription}
            onCancelTranscription={handleCancelTranscription}
          />
        )}

        {/* ── SECTION 3: AI-DERIVED FORENSIC FINDINGS ── */}
        <View style={styles.sectionBadgeRow}>
          <Text style={[styles.sectionBadgeText, { color: palette.primary }]}>
            AI-DERIVED FORENSIC FINDINGS (ON-DEVICE GEMMA 2B)
          </Text>
        </View>

        <ForensicAnalysisCard
          caseId={item.caseId}
          evidenceId={item.id}
          onAnalysisCompleted={() => fetchEvidence(item.caseId)}
        />

        {/* ── SECTION 4: INTEGRITY LEDGER ── */}
        <View style={styles.sectionBadgeRow}>
          <Text style={[styles.sectionBadgeText, { color: palette.success }]}>
            CRYPTOGRAPHIC INTEGRITY LEDGER
          </Text>
        </View>

        <IntegrityPanel
          evidenceId={item.id}
          fileName={item.fileName}
        />
      </ScrollView>
    </View>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background,
  },
  content: {
    padding: 16,
  },
  card: {
    backgroundColor: palette.card,
    borderRadius: 10,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: palette.border,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: palette.primary,
    marginBottom: 8,
  },
  monoLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    color: palette.secondary,
    marginTop: 4,
  },
  monoVal: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: palette.text,
    marginBottom: 6,
  },
  metaLine: {
    fontSize: 13,
    color: palette.text,
    marginBottom: 4,
  },
  aiSummary: {
    fontSize: 13,
    color: palette.text,
    fontStyle: 'italic',
    marginBottom: 6,
  },
  errText: {
    color: palette.error,
    padding: 20,
    textAlign: 'center',
  },
  sectionBadgeRow: {
    marginBottom: 8,
    marginTop: 6,
  },
  sectionBadgeText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: palette.secondary,
    letterSpacing: 0.8,
  },
  boldText: {
    fontWeight: 'bold',
    color: palette.textSecondary,
  },
});

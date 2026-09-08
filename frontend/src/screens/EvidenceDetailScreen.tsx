import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity } from 'react-native';
import { useEvidenceStore } from '../store/evidenceStore';
import { AppHeader } from '../components/AppHeader';
import { AudioTranscriptionCard } from '../components/AudioTranscriptionCard';
import { ImageOcrCard } from '../components/ImageOcrCard';
import { ForensicAnalysisCard } from '../components/ForensicAnalysisCard';
import { IntegrityPanel } from '../components/IntegrityPanel';
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

  // OCR State
  const [ocrStatus, setOcrStatus] = useState<OcrStatus>('IDLE');
  const [ocrResult, setOcrResult] = useState<OcrResult | null>(null);
  const [imageError, setImageError] = useState(false);

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
      <AppHeader title={item.title || item.fileName} subtitle={`ID: ${item.id.substring(0, 12)}… · ${item.type}`} />
      <ScrollView contentContainerStyle={styles.content}>
        
        {/* ── MEDIA PREVIEW SECTION ── */}
        <View style={styles.sectionBadgeRow}>
          <Text style={styles.sectionBadgeText}>PRESERVED EVIDENCE PREVIEW</Text>
        </View>

        <View style={styles.previewCard}>
          {item.type === 'IMAGE' ? (
            !imageError && item.fileUri && !item.fileUri.startsWith('clipboard://') ? (
              <View style={styles.imageContainer}>
                <Image
                  source={{ uri: item.fileUri }}
                  style={styles.imagePreview}
                  resizeMode="contain"
                  onError={() => setImageError(true)}
                />
                <Text style={styles.previewSubtext}>Source: Preserved App-Sandbox Copy</Text>
              </View>
            ) : (
              <View style={styles.fallbackContainer}>
                <Text style={styles.fallbackIcon}>🖼️</Text>
                <Text style={styles.fallbackTitle}>{item.fileName}</Text>
                <Text style={styles.fallbackSub}>
                  {imageError ? 'Preview unavailable (rendering error)' : 'Image preserved in sandbox'}
                </Text>
              </View>
            )
          ) : item.type === 'AUDIO' ? (
            <View style={styles.audioPreviewContainer}>
              <Text style={styles.audioPreviewIcon}>🎙️</Text>
              <Text style={styles.audioPreviewTitle}>{item.fileName}</Text>
              <Text style={styles.audioPreviewMeta}>
                Audio Container: {item.mimeType || 'audio/*'} • {formatFileSize(item.fileSize)}
              </Text>
              <Text style={styles.audioPreviewNotice}>
                16kHz mono WAV format recommended for Whisper on-device transcription
              </Text>
            </View>
          ) : item.type === 'DOCUMENT' ? (
            <View style={styles.docPreviewContainer}>
              <Text style={styles.docPreviewIcon}>📄</Text>
              <Text style={styles.docPreviewTitle}>{item.fileName}</Text>
              <Text style={styles.docPreviewMeta}>
                Document Format: {item.mimeType || 'application/octet-stream'} • {formatFileSize(item.fileSize)}
              </Text>
            </View>
          ) : (
            <View style={styles.fallbackContainer}>
              <Text style={styles.fallbackIcon}>📁</Text>
              <Text style={styles.fallbackTitle}>{item.fileName}</Text>
              <Text style={styles.fallbackSub}>{item.type} Evidence File</Text>
            </View>
          )}
        </View>

        {/* ── SECTION 1: SOURCE EVIDENCE & PRIVATE STORAGE ── */}
        <View style={styles.sectionBadgeRow}>
          <Text style={styles.sectionBadgeText}>SOURCE EVIDENCE (AUTHORITATIVE)</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Source & Storage Provenance</Text>
          <Text style={styles.metaLine}><Text style={styles.boldText}>Filename: </Text>{item.fileName}</Text>
          <Text style={styles.metaLine}><Text style={styles.boldText}>Media Type: </Text>{item.type} ({item.mimeType})</Text>
          <Text style={styles.metaLine}><Text style={styles.boldText}>File Size: </Text>{formatFileSize(item.fileSize)}</Text>
          
          <View style={styles.storageBox}>
            <Text style={styles.storageBoxTitle}>TRACE PRESERVED COPY (SANDBOX)</Text>
            <Text style={styles.storageBoxPath} numberOfLines={2} selectable>
              {item.fileUri}
            </Text>
            <Text style={styles.storageBoxNote}>
              Preserved in app-private sandbox storage. External apps cannot mutate this forensic copy.
            </Text>
          </View>
        </View>

        {/* ── SECTION 2: TIMESTAMP PROVENANCE ── */}
        <View style={styles.sectionBadgeRow}>
          <Text style={styles.sectionBadgeText}>TIMESTAMP PROVENANCE</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Temporal Attribution</Text>
          
          <View style={styles.timestampRow}>
            <Text style={styles.timestampLabel}>CAPTURE TIME (EXIF):</Text>
            <Text style={styles.timestampVal}>
              {item.exifData?.dateTimeOriginal || 'Not available in source EXIF'}
            </Text>
            <View style={[styles.provenanceBadge, item.exifData?.dateTimeOriginal ? styles.badgeExif : styles.badgeNone]}>
              <Text style={styles.provenanceBadgeText}>
                {item.exifData?.dateTimeOriginal ? 'EXIF VERIFIED' : 'NOT DETECTED'}
              </Text>
            </View>
          </View>

          <View style={styles.timestampRow}>
            <Text style={styles.timestampLabel}>IMPORT TIME:</Text>
            <Text style={styles.timestampVal}>{formatDate(item.timestamp)}</Text>
            <View style={[styles.provenanceBadge, styles.badgeImport]}>
              <Text style={styles.provenanceBadgeText}>IMPORT</Text>
            </View>
          </View>

          {item.exifData && (item.exifData.make || item.exifData.model || item.exifData.gpsLatitude) ? (
            <View style={styles.exifDetailsBox}>
              <Text style={styles.exifDetailsTitle}>Embedded EXIF Tags:</Text>
              {item.exifData.make || item.exifData.model ? (
                <Text style={styles.metaLine}>Device: {item.exifData.make} {item.exifData.model}</Text>
              ) : null}
              {item.exifData.gpsLatitude && item.exifData.gpsLongitude ? (
                <Text style={styles.metaLine}>GPS: {item.exifData.gpsLatitude}, {item.exifData.gpsLongitude}</Text>
              ) : null}
              {item.exifData.gpsAltitude ? (
                <Text style={styles.metaLine}>Altitude: {item.exifData.gpsAltitude} m</Text>
              ) : null}
            </View>
          ) : null}
        </View>

        {/* ── SECTION 3: CRYPTOGRAPHIC PROOF ── */}
        <View style={styles.sectionBadgeRow}>
          <Text style={styles.sectionBadgeText}>CRYPTOGRAPHIC INTEGRITY</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>SHA-256 Digest</Text>
          <Text style={styles.monoLabel}>Preserved File Hash:</Text>
          <Text style={styles.monoVal} selectable>{item.sha256Hash}</Text>
          <Text style={styles.hashNote}>
            Computed directly on copied bytes in private sandbox storage upon intake.
          </Text>
          {item.signature ? (
            <>
              <Text style={styles.monoLabel}>Hardware Signature:</Text>
              <Text style={styles.monoVal} selectable>{item.signature}</Text>
            </>
          ) : null}
        </View>

        {/* ── SECTION 4: EXTRACTED CONTENT (OCR / WHISPER) ── */}
        <View style={styles.sectionBadgeRow}>
          <Text style={styles.sectionBadgeText}>EXTRACTED CONTENT (DETERMINISTIC / DERIVED)</Text>
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

        {/* ── SECTION 5: AI-DERIVED FORENSIC FINDINGS ── */}
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

        {/* ── SECTION 6: INTEGRITY LEDGER ── */}
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
    paddingBottom: 40,
  },
  previewCard: {
    backgroundColor: palette.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 12,
    marginBottom: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageContainer: {
    width: '100%',
    alignItems: 'center',
  },
  imagePreview: {
    width: '100%',
    height: 240,
    borderRadius: 8,
    backgroundColor: palette.surfaceVariant,
  },
  previewSubtext: {
    fontSize: 10,
    color: palette.textSecondary,
    marginTop: 6,
  },
  fallbackContainer: {
    padding: 24,
    alignItems: 'center',
  },
  fallbackIcon: {
    fontSize: 40,
    marginBottom: 8,
  },
  fallbackTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: palette.text,
  },
  fallbackSub: {
    fontSize: 11,
    color: palette.textSecondary,
    marginTop: 2,
  },
  audioPreviewContainer: {
    padding: 20,
    alignItems: 'center',
    width: '100%',
  },
  audioPreviewIcon: {
    fontSize: 36,
    marginBottom: 8,
  },
  audioPreviewTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: palette.text,
  },
  audioPreviewMeta: {
    fontSize: 12,
    color: palette.primary,
    marginTop: 4,
  },
  audioPreviewNotice: {
    fontSize: 10,
    color: palette.textSecondary,
    marginTop: 8,
    textAlign: 'center',
  },
  docPreviewContainer: {
    padding: 20,
    alignItems: 'center',
    width: '100%',
  },
  docPreviewIcon: {
    fontSize: 36,
    marginBottom: 8,
  },
  docPreviewTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: palette.text,
  },
  docPreviewMeta: {
    fontSize: 12,
    color: palette.secondary,
    marginTop: 4,
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
    marginBottom: 10,
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
    backgroundColor: 'rgba(0,0,0,0.2)',
    padding: 6,
    borderRadius: 4,
  },
  hashNote: {
    fontSize: 10,
    color: palette.textSecondary,
    fontStyle: 'italic',
    marginTop: 2,
  },
  metaLine: {
    fontSize: 13,
    color: palette.text,
    marginBottom: 4,
  },
  storageBox: {
    backgroundColor: 'rgba(0, 242, 254, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(0, 242, 254, 0.15)',
    borderRadius: 6,
    padding: 10,
    marginTop: 10,
  },
  storageBoxTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: palette.primary,
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  storageBoxPath: {
    fontSize: 10,
    fontFamily: 'monospace',
    color: palette.textSecondary,
    marginBottom: 4,
  },
  storageBoxNote: {
    fontSize: 10,
    color: palette.textSecondary,
    fontStyle: 'italic',
  },
  timestampRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  timestampLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    color: palette.textSecondary,
  },
  timestampVal: {
    fontSize: 12,
    color: palette.text,
    flex: 1,
    marginHorizontal: 8,
    textAlign: 'right',
  },
  provenanceBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeExif: {
    backgroundColor: '#064E3B',
  },
  badgeImport: {
    backgroundColor: '#1E293B',
  },
  badgeNone: {
    backgroundColor: '#374151',
  },
  provenanceBadgeText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#E2E8F0',
  },
  exifDetailsBox: {
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: 6,
    padding: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: palette.border,
  },
  exifDetailsTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: palette.secondary,
    marginBottom: 4,
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

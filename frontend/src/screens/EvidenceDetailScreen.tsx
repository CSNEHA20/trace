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
import { Colors, Spacing, Radius, Typography, Shadows } from '../theme';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { formatDate, formatFileSize } from '../utils/crypto';
import { TranscriptionStatus, TranscriptionResult, OcrStatus, OcrResult } from '../types';

export function EvidenceDetailScreen() {
  const router = useRouter();
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
      <AppHeader
        title={item.title || item.fileName}
        subtitle={`ID: ${item.id.substring(0, 12)}… · ${item.type}`}
        showBack
        onBack={() => router.back()}
      />
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
              <Text style={[styles.provenanceBadgeText, { color: item.exifData?.dateTimeOriginal ? Colors.emerald : Colors.crimson }]}>
                {item.exifData?.dateTimeOriginal ? 'EXIF VERIFIED' : 'NOT DETECTED'}
              </Text>
            </View>
          </View>

          <View style={styles.timestampRow}>
            <Text style={styles.timestampLabel}>IMPORT TIME:</Text>
            <Text style={styles.timestampVal}>{formatDate(item.timestamp)}</Text>
            <View style={[styles.provenanceBadge, styles.badgeImport]}>
              <Text style={[styles.provenanceBadgeText, { color: Colors.textMuted }]}>IMPORT</Text>
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
          <Text style={[styles.sectionBadgeText, { color: Colors.amber }]}>
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
          <Text style={[styles.sectionBadgeText, { color: Colors.emerald }]}>
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
    backgroundColor: Colors.canvasParchment,
  },
  content: {
    padding: Spacing.md,
    paddingBottom: 40,
  },
  previewCard: {
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderColor: Colors.border,
    padding: 14,
    marginBottom: 16,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.card,
  },
  imageContainer: {
    width: '100%',
    alignItems: 'center',
  },
  imagePreview: {
    width: '100%',
    height: 240,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
  },
  previewSubtext: {
    ...Typography.body,
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 8,
  },
  fallbackContainer: {
    padding: 28,
    alignItems: 'center',
  },
  fallbackIcon: {
    fontSize: 40,
    marginBottom: 8,
  },
  fallbackTitle: {
    ...Typography.headline,
    fontSize: 15,
    color: Colors.ink,
  },
  fallbackSub: {
    ...Typography.body,
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 4,
  },
  audioPreviewContainer: {
    padding: 24,
    alignItems: 'center',
    width: '100%',
  },
  audioPreviewIcon: {
    fontSize: 36,
    marginBottom: 8,
  },
  audioPreviewTitle: {
    ...Typography.headline,
    fontSize: 15,
    color: Colors.ink,
  },
  audioPreviewMeta: {
    ...Typography.bodyStrong,
    fontSize: 12,
    color: Colors.primary,
    marginTop: 4,
  },
  audioPreviewNotice: {
    ...Typography.body,
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 16,
  },
  docPreviewContainer: {
    padding: 24,
    alignItems: 'center',
    width: '100%',
  },
  docPreviewIcon: {
    fontSize: 36,
    marginBottom: 8,
  },
  docPreviewTitle: {
    ...Typography.headline,
    fontSize: 15,
    color: Colors.ink,
  },
  docPreviewMeta: {
    ...Typography.bodyStrong,
    fontSize: 12,
    color: Colors.primary,
    marginTop: 4,
  },
  card: {
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.lg,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: Colors.border,
    ...Shadows.elevated,
  },
  sectionTitle: {
    ...Typography.subtopHeading,
    fontSize: 15,
    color: Colors.ink,
    marginBottom: 12,
  },
  monoLabel: {
    ...Typography.subtopLabel,
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 6,
    marginBottom: 3,
  },
  monoVal: {
    ...Typography.mono,
    fontSize: 11,
    color: Colors.ink,
    marginBottom: 6,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 10,
    borderRadius: Radius.sm,
  },
  hashNote: {
    ...Typography.body,
    fontSize: 11,
    color: Colors.textMuted,
    fontStyle: 'italic',
    marginTop: 2,
  },
  metaLine: {
    ...Typography.body,
    fontSize: 13,
    color: Colors.ink,
    marginBottom: 6,
    lineHeight: 19,
  },
  storageBox: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: 12,
    marginTop: 10,
  },
  storageBoxTitle: {
    ...Typography.subtopLabel,
    fontSize: 10,
    color: Colors.textMuted,
    marginBottom: 4,
  },
  storageBoxPath: {
    ...Typography.mono,
    fontSize: 11,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  storageBoxNote: {
    ...Typography.body,
    fontSize: 11,
    color: Colors.textMuted,
    fontStyle: 'italic',
  },
  timestampRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  timestampLabel: {
    ...Typography.subtopLabel,
    fontSize: 11,
    color: Colors.textMuted,
  },
  timestampVal: {
    ...Typography.body,
    fontSize: 12,
    color: Colors.ink,
    flex: 1,
    marginHorizontal: 8,
    textAlign: 'right',
  },
  provenanceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  badgeExif: {
    backgroundColor: 'rgba(5, 150, 105, 0.12)',
    borderColor: 'rgba(5, 150, 105, 0.35)',
  },
  badgeImport: {
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
  },
  badgeNone: {
    backgroundColor: 'rgba(220, 38, 38, 0.12)',
    borderColor: 'rgba(220, 38, 38, 0.35)',
  },
  provenanceBadgeText: {
    ...Typography.subtopLabel,
    fontSize: 9,
  },
  exifDetailsBox: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  exifDetailsTitle: {
    ...Typography.subtopLabel,
    fontSize: 11,
    color: Colors.textMuted,
    marginBottom: 6,
  },
  errText: {
    ...Typography.bodyStrong,
    color: Colors.crimson,
    padding: 20,
    textAlign: 'center',
  },
  sectionBadgeRow: {
    marginBottom: 8,
    marginTop: 6,
  },
  sectionBadgeText: {
    ...Typography.subtopLabel,
    fontSize: 11,
    color: Colors.textMuted,
  },
  boldText: {
    ...Typography.subtopHeading,
    fontSize: 12,
    color: Colors.textMuted,
  },
});

import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useEvidenceStore } from '../store/evidenceStore';
import { AppHeader } from '../components/AppHeader';
import { palette } from '../theme';
import { useLocalSearchParams } from 'expo-router';
import { formatDate, formatFileSize } from '../utils/crypto';

export function EvidenceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const item = useEvidenceStore((state) => state.evidenceList.find((e) => e.id === id) || state.selectedEvidence);

  if (!item) {
    return (
      <View style={styles.container}>
        <AppHeader title="Evidence Item" />
        <Text style={styles.errText}>Evidence item not found.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AppHeader title={item.title} subtitle={`Type: ${item.type}`} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Cryptographic Proof</Text>
          <Text style={styles.monoLabel}>SHA-256 Hash:</Text>
          <Text style={styles.monoVal}>{item.sha256Hash}</Text>
          <Text style={styles.monoLabel}>Hardware Signature:</Text>
          <Text style={styles.monoVal}>{item.signature}</Text>
        </View>

        {item.exifData ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>EXIF Forensic Metadata</Text>
            <Text style={styles.metaLine}>Device: {item.exifData.make} {item.exifData.model}</Text>
            <Text style={styles.metaLine}>Capture Time: {item.exifData.dateTimeOriginal}</Text>
            <Text style={styles.metaLine}>GPS Coordinates: {item.exifData.gpsLatitude}, {item.exifData.gpsLongitude}</Text>
          </View>
        ) : null}

        {item.aiAnalysis ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>On-Device AI Inference</Text>
            <Text style={styles.aiSummary}>{item.aiAnalysis.gemmaSummary}</Text>
            {item.aiAnalysis.detectedText?.length ? (
              <Text style={styles.metaLine}>OCR Text: {item.aiAnalysis.detectedText.join(', ')}</Text>
            ) : null}
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>File Metadata</Text>
          <Text style={styles.metaLine}>Size: {formatFileSize(item.fileSize)}</Text>
          <Text style={styles.metaLine}>MIME Type: {item.mimeType}</Text>
          <Text style={styles.metaLine}>Timestamp: {formatDate(item.timestamp)}</Text>
        </View>
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
});

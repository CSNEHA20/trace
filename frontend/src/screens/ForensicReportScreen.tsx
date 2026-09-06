import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Switch,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { palette } from '../theme';
import { useCaseStore } from '../store/caseStore';
import { useEvidenceStore } from '../store/evidenceStore';
import { useReportStore } from '../store/reportStore';
import { ForensicReportPreviewModal } from '../components/ForensicReportPreviewModal';
import { formatDate } from '../utils/crypto';

export const ForensicReportScreen: React.FC = () => {
  const { cases, activeCase } = useCaseStore();
  const { evidenceList } = useEvidenceStore();
  const {
    options,
    status,
    lastManifest,
    generatedReports,
    updateOptions,
    generateReport,
    shareCurrentReport,
  } = useReportStore();

  const [previewVisible, setPreviewVisible] = useState(false);

  // Active case selection
  const selectedCase = activeCase || cases[0] || {
    id: 'CASE-001',
    caseNumber: 'TR-2026-001',
    title: 'Default Forensic Case',
    investigatorName: 'SNEHA C',
    status: 'ACTIVE',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    evidenceIds: [],
  };

  const caseEvidence = evidenceList.filter((e) => !e.caseId || e.caseId === selectedCase.id);
  const tamperedCount = caseEvidence.filter((e) => e.isTampered).length;
  const isGenerating = status === 'GENERATING_HTML' || status === 'SIGNING' || status === 'CREATING_PDF';

  const handleGenerate = async () => {
    if (caseEvidence.length === 0) {
      Alert.alert(
        'Empty Case',
        'No evidence records found for this case. Ingest evidence items before generating a report.'
      );
      return;
    }

    const result = await generateReport(selectedCase, caseEvidence);
    if (result) {
      setPreviewVisible(true);
    }
  };

  const handleShare = async () => {
    await shareCurrentReport();
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Forensic Report Generator</Text>
          <Text style={styles.headerSubtitle}>
            Court-admissible digital evidence audit & cryptographic signing
          </Text>
        </View>

        {/* Case Summary Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Target Case Summary</Text>
          <View style={styles.caseRow}>
            <View>
              <Text style={styles.caseNumber}>{selectedCase.caseNumber}</Text>
              <Text style={styles.caseTitleStr}>{selectedCase.title}</Text>
            </View>
            <View style={styles.badgeContainer}>
              <Text style={styles.badgeText}>{selectedCase.status}</Text>
            </View>
          </View>

          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <Text style={styles.statVal}>{caseEvidence.length}</Text>
              <Text style={styles.statLabel}>Evidence Items</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={[styles.statVal, tamperedCount > 0 ? styles.textRed : styles.textGreen]}>
                {tamperedCount === 0 ? '0' : tamperedCount}
              </Text>
              <Text style={styles.statLabel}>Tampered Items</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statVal}>SHA-256</Text>
              <Text style={styles.statLabel}>Crypto Engine</Text>
            </View>
          </View>
        </View>

        {/* Report Options Customization */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Report Customization</Text>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Agency / Organization Name</Text>
            <TextInput
              style={styles.input}
              value={options.agencyName}
              onChangeText={(text) => updateOptions({ agencyName: text })}
              placeholder="e.g. TRACE Digital Forensics Lab"
              placeholderTextColor={palette.textSecondary}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Investigator Remarks & Notes</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={options.investigatorNotes || ''}
              onChangeText={(text) => updateOptions({ investigatorNotes: text })}
              placeholder="Add findings, scene notes, or legal observations..."
              placeholderTextColor={palette.textSecondary}
              multiline
              numberOfLines={3}
            />
          </View>

          <View style={styles.switchRow}>
            <View style={styles.switchTextGroup}>
              <Text style={styles.switchLabel}>Include AI Summaries & OCR</Text>
              <Text style={styles.switchSublabel}>Embed Gemma 2B summaries, ML Kit text & transcriptions</Text>
            </View>
            <Switch
              value={options.includeAiSummaries}
              onValueChange={(val) => updateOptions({ includeAiSummaries: val })}
              trackColor={{ false: palette.border, true: palette.primary }}
            />
          </View>

          <View style={styles.switchRow}>
            <View style={styles.switchTextGroup}>
              <Text style={styles.switchLabel}>Include EXIF Metadata</Text>
              <Text style={styles.switchSublabel}>Device camera models, timestamps & GPS coordinates</Text>
            </View>
            <Switch
              value={options.includeExifMetadata}
              onValueChange={(val) => updateOptions({ includeExifMetadata: val })}
              trackColor={{ false: palette.border, true: palette.primary }}
            />
          </View>

          <View style={styles.switchRow}>
            <View style={styles.switchTextGroup}>
              <Text style={styles.switchLabel}>Include Cryptographic Chain</Text>
              <Text style={styles.switchSublabel}>Embed full hash chain audit trail entries</Text>
            </View>
            <Switch
              value={options.includeHashChain}
              onValueChange={(val) => updateOptions({ includeHashChain: val })}
              trackColor={{ false: palette.border, true: palette.primary }}
            />
          </View>
        </View>

        {/* Action Button */}
        <TouchableOpacity
          style={[styles.generateButton, isGenerating && styles.disabledButton]}
          onPress={handleGenerate}
          disabled={isGenerating}
        >
          {isGenerating ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color="#ffffff" size="small" />
              <Text style={styles.generateButtonText}>
                {status === 'GENERATING_HTML'
                  ? ' Rendering HTML Report...'
                  : status === 'SIGNING'
                  ? ' Signing Cryptographic Seal...'
                  : ' Exporting PDF...'}
              </Text>
            </View>
          ) : (
            <Text style={styles.generateButtonText}>📄 Generate Forensic PDF Report</Text>
          )}
        </TouchableOpacity>

        {/* History List */}
        {generatedReports.length > 0 ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Generated Reports History ({generatedReports.length})</Text>
            {generatedReports.map((rep) => (
              <View key={rep.reportId} style={styles.historyRow}>
                <View>
                  <Text style={styles.historyTitle}>Case #{rep.caseNumber}</Text>
                  <Text style={styles.historyMeta}>
                    {formatDate(rep.generatedAt)} • {rep.evidenceCount} items
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.viewButton}
                  onPress={() => {
                    useReportStore.setState({ lastManifest: rep });
                    setPreviewVisible(true);
                  }}
                >
                  <Text style={styles.viewButtonText}>View / Export</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>

      {/* Report Preview Modal */}
      <ForensicReportPreviewModal
        visible={previewVisible}
        manifest={lastManifest}
        onClose={() => setPreviewVisible(false)}
        onShare={handleShare}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: palette.text,
  },
  headerSubtitle: {
    fontSize: 12,
    color: palette.textSecondary,
    marginTop: 4,
  },
  card: {
    backgroundColor: palette.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: palette.border,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: palette.primary,
    marginBottom: 12,
  },
  caseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  caseNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: palette.text,
  },
  caseTitleStr: {
    fontSize: 12,
    color: palette.textSecondary,
    marginTop: 2,
  },
  badgeContainer: {
    backgroundColor: 'rgba(30, 64, 175, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: palette.primary,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  statBox: {
    flex: 1,
    backgroundColor: palette.background,
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  statVal: {
    fontSize: 16,
    fontWeight: 'bold',
    color: palette.text,
  },
  statLabel: {
    fontSize: 10,
    color: palette.textSecondary,
    marginTop: 2,
  },
  textGreen: {
    color: '#10b981',
  },
  textRed: {
    color: '#ef4444',
  },
  fieldGroup: {
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: palette.text,
    marginBottom: 6,
  },
  input: {
    backgroundColor: palette.background,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 8,
    padding: 10,
    fontSize: 13,
    color: palette.text,
  },
  textArea: {
    height: 70,
    textAlignVertical: 'top',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: palette.border,
  },
  switchTextGroup: {
    flex: 1,
    paddingRight: 10,
  },
  switchLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: palette.text,
  },
  switchSublabel: {
    fontSize: 11,
    color: palette.textSecondary,
    marginTop: 2,
  },
  generateButton: {
    backgroundColor: palette.primary,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 16,
    elevation: 2,
  },
  disabledButton: {
    opacity: 0.7,
  },
  generateButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 15,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  historyTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: palette.text,
  },
  historyMeta: {
    fontSize: 11,
    color: palette.textSecondary,
    marginTop: 2,
  },
  viewButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: palette.background,
    borderWidth: 1,
    borderColor: palette.primary,
  },
  viewButtonText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: palette.primary,
  },
});

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Switch,
  Alert,
  ActivityIndicator,
  Picker,
} from 'react-native';
import { palette } from '../theme';
import { useCaseStore } from '../store/caseStore';
import { useEvidenceStore } from '../store/evidenceStore';
import { incidentReportGenerator } from './IncidentReportGenerator';
import { IncidentReportOptions, DEFAULT_INCIDENT_REPORT_OPTIONS } from '../types/report';
import { logger } from '../utils/logger';
import { databaseService } from '../services/databaseService';
import { EventRecord } from '../types';

export const IncidentReportConfigScreen: React.FC = () => {
  const { cases, activeCaseId } = useCaseStore();
  const { evidenceItems } = useEvidenceStore();
  
  const [options, setOptions] = useState<IncidentReportOptions>(DEFAULT_INCIDENT_REPORT_OPTIONS);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState<string>('');
  const [previewVisible, setPreviewVisible] = useState(false);
  const [lastResult, setLastResult] = useState<{
    pdfUri: string;
    manifestUri: string;
    metadata: any;
  } | null>(null);
  const [caseEvents, setCaseEvents] = useState<EventRecord[]>([]);

  // Active case selection
  const activeCase = cases.find((c) => c.id === activeCaseId) || cases[0] || null;
  const caseEvidence = activeCase 
    ? evidenceItems.filter((e) => e.caseId === activeCase.id)
    : [];

  // Load events when active case changes
  React.useEffect(() => {
    if (activeCase) {
      databaseService.getEventsForCase(activeCase.id).then(setCaseEvents);
    } else {
      setCaseEvents([]);
    }
  }, [activeCase]);

  const handleOptionChange = useCallback((key: keyof IncidentReportOptions, value: any) => {
    setOptions((prev) => ({ ...prev, [key]: value }));
    incidentReportGenerator.updateOptions({ [key]: value });
  }, []);

  const handleGenerate = async () => {
    if (!activeCase) {
      Alert.alert('No Case Selected', 'Please select or create a case first.');
      return;
    }

    if (caseEvidence.length === 0 && caseEvents.length === 0) {
      Alert.alert(
        'Empty Case',
        'No evidence records or events found for this case. Add evidence or timeline events before generating a report.'
      );
      return;
    }

    setIsGenerating(true);
    setGenerationStatus('Gathering case data...');

    try {
      // Generate the report
      const result = await incidentReportGenerator.generateReport(activeCase.id);
      
      if (result) {
        setGenerationStatus('Report generated successfully!');
        setLastResult({
          pdfUri: result.pdfUri,
          manifestUri: '', // Will be available after manifest is saved
          metadata: result.metadata,
        });
        setPreviewVisible(true);
      }
    } catch (error) {
      const msg = (error as Error)?.message || 'Failed to generate report';
      logger.error('Report generation error', error);
      Alert.alert('Generation Failed', msg);
      setGenerationStatus('Generation failed');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleShare = async () => {
    if (!lastResult) return;
    
    setGenerationStatus('Preparing to share...');
    try {
      // We need to get the manifest URI from the generator
      // For now, just share the PDF
      const { Sharing } = await import('expo-sharing');
      const isAvailable = await Sharing.isAvailableAsync();
      
      if (isAvailable) {
        await Sharing.shareAsync(lastResult.pdfUri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Share TRACE Incident Report',
          UTI: 'com.adobe.pdf',
        });
        setGenerationStatus('Shared successfully');
      } else {
        Alert.alert('Sharing Not Available', 'File sharing is not supported on this platform.');
      }
    } catch (error) {
      logger.error('Share failed', error);
      Alert.alert('Share Failed', 'Could not share the report.');
    }
  };

  const handleSaveManifest = async () => {
    if (!lastResult) return;
    
    try {
      // The manifest.txt is already saved during generation
      Alert.alert('Manifest Saved', 'Hash manifest (.txt) has been saved to the exports directory.');
    } catch (error) {
      logger.error('Save manifest failed', error);
    }
  };

  if (!activeCase) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No Active Case</Text>
          <Text style={styles.emptyDesc}>
            Please create or select a case from the Cases screen before generating an incident report.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Incident Report Generator</Text>
          <Text style={styles.headerSubtitle}>
            Court-admissible incident report with full cryptographic chain of custody
          </Text>
        </View>

        {/* Case Summary Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Target Case Summary</Text>
          <View style={styles.caseRow}>
            <View>
              <Text style={styles.caseNumber}>{activeCase.caseNumber}</Text>
              <Text style={styles.caseTitleStr}>{activeCase.title}</Text>
            </View>
            <View style={styles.badgeContainer}>
              <Text style={styles.badgeText}>{activeCase.status}</Text>
            </View>
          </View>

          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <Text style={styles.statVal}>{caseEvidence.length}</Text>
              <Text style={styles.statLabel}>Evidence Items</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statVal}>{caseEvents.length}</Text>
              <Text style={styles.statLabel}>Timeline Events</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statVal}>SHA-256</Text>
              <Text style={styles.statLabel}>Crypto Engine</Text>
            </View>
          </View>
        </View>

        {/* Report Options - Core Sections */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Report Sections</Text>

          <View style={styles.switchRow}>
            <View style={styles.switchTextGroup}>
              <Text style={styles.switchLabel}>AI Incident Narrative</Text>
              <Text style={styles.switchSublabel}>Include Gemma 2B generated incident narrative</Text>
            </View>
            <Switch
              value={options.includeAiNarrative}
              onValueChange={(val) => handleOptionChange('includeAiNarrative', val)}
              trackColor={{ false: palette.border, true: palette.primary }}
            />
          </View>

          <View style={styles.switchRow}>
            <View style={styles.switchTextGroup}>
              <Text style={styles.switchLabel}>Chronological Event Log</Text>
              <Text style={styles.switchSublabel}>Timestamp, event type, severity, evidence refs</Text>
            </View>
            <Switch
              value={options.includeEventLog}
              onValueChange={(val) => handleOptionChange('includeEventLog', val)}
              trackColor={{ false: palette.border, true: palette.primary }}
            />
          </View>

          <View style={styles.switchRow}>
            <View style={styles.switchTextGroup}>
              <Text style={styles.switchLabel}>Evidence Inventory</Text>
              <Text style={styles.switchSublabel}>Filename, type, import date, SHA-256 hash</Text>
            </View>
            <Switch
              value={options.includeEvidenceInventory}
              onValueChange={(val) => handleOptionChange('includeEvidenceInventory', val)}
              trackColor={{ false: palette.border, true: palette.primary }}
            />
          </View>

          <View style={styles.switchRow}>
            <View style={styles.switchTextGroup}>
              <Text style={styles.switchLabel}>Hash Chain Manifest</Text>
              <Text style={styles.switchSublabel}>Full cryptographic chain of custody entries</Text>
            </View>
            <Switch
              value={options.includeHashChain}
              onValueChange={(val) => handleOptionChange('includeHashChain', val)}
              trackColor={{ false: palette.border, true: palette.primary }}
            />
          </View>

          <View style={styles.switchRow}>
            <View style={styles.switchTextGroup}>
              <Text style={styles.switchLabel}>Appendix (Thumbnails)</Text>
              <Text style={styles.switchSublabel}>Selected evidence screenshots with redaction</Text>
            </View>
            <Switch
              value={options.includeAppendix}
              onValueChange={(val) => handleOptionChange('includeAppendix', val)}
              trackColor={{ false: palette.border, true: palette.primary }}
            />
          </View>
        </View>

        {/* Report Options - Content Options */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Content Options</Text>

          <View style={styles.switchRow}>
            <View style={styles.switchTextGroup}>
              <Text style={styles.switchLabel}>Include OCR / Transcription</Text>
              <Text style={styles.switchSublabel}>Embed extracted text and audio transcriptions</Text>
            </View>
            <Switch
              value={options.includeOCR}
              onValueChange={(val) => handleOptionChange('includeOCR', val)}
              trackColor={{ false: palette.border, true: palette.primary }}
            />
          </View>

          <View style={styles.switchRow}>
            <View style={styles.switchTextGroup}>
              <Text style={styles.switchLabel}>Include Thumbnails</Text>
              <Text style={styles.switchSublabel}>Render image thumbnails in appendix</Text>
            </View>
            <Switch
              value={options.includeThumbnails}
              onValueChange={(val) => handleOptionChange('includeThumbnails', val)}
              trackColor={{ false: palette.border, true: palette.primary }}
            />
          </View>
        </View>

        {/* Report Options - Victim Privacy */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Victim Privacy & Identity</Text>

          <View style={styles.switchRow}>
            <View style={styles.switchTextGroup}>
              <Text style={styles.switchLabel}>Anonymize Victim</Text>
              <Text style={styles.switchSublabel}>Redact victim identity throughout report</Text>
            </View>
            <Switch
              value={options.anonymizeVictim}
              onValueChange={(val) => handleOptionChange('anonymizeVictim', val)}
              trackColor={{ false: palette.border, true: palette.primary }}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Victim Display Mode</Text>
            <Picker
              selectedValue={options.victimDisplayMode}
              onValueChange={(val) => handleOptionChange('victimDisplayMode', val)}
              style={styles.picker}
              mode="dialog"
            >
              <Picker.Item label="Anonymized (VICTIM [REDACTED])" value="anonymized" />
              <Picker.Item label="Named (Full Identity)" value="named" />
            </Picker>
          </View>
        </View>

        {/* Report Options - Metadata */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Report Metadata</Text>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Agency / Organization Name</Text>
            <TextInput
              style={styles.input}
              value={options.agencyName}
              onChangeText={(text) => handleOptionChange('agencyName', text)}
              placeholder="e.g. TRACE Digital Forensics Unit"
              placeholderTextColor={palette.textSecondary}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Investigator Remarks & Notes</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={options.investigatorNotes || ''}
              onChangeText={(text) => handleOptionChange('investigatorNotes', text)}
              placeholder="Add findings, scene notes, or legal observations..."
              placeholderTextColor={palette.textSecondary}
              multiline
              numberOfLines={3}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Report Format</Text>
            <Picker
              selectedValue={options.reportFormat}
              onValueChange={(val) => handleOptionChange('reportFormat', val)}
              style={styles.picker}
              mode="dialog"
            >
              <Picker.Item label="PDF (Portable Document Format)" value="PDF" />
              <Picker.Item label="HTML (Web Archive)" value="HTML" />
              <Picker.Item label="TXT (Plain Text Manifest)" value="TXT" />
            </Picker>
          </View>
        </View>

        {/* Action Buttons */}
        <TouchableOpacity
          style={[styles.generateButton, isGenerating && styles.disabledButton]}
          onPress={handleGenerate}
          disabled={isGenerating || (caseEvidence.length === 0 && caseEvents.length === 0)}
        >
          {isGenerating ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color="#ffffff" size="small" />
              <Text style={styles.generateButtonText}>{generationStatus}</Text>
            </View>
          ) : (
            <Text style={styles.generateButtonText}>
              📄 Generate Incident Report
            </Text>
          )}
        </TouchableOpacity>

        {caseEvidence.length === 0 && caseEvents.length === 0 && (
          <Text style={styles.emptyWarning}>
            ⚠ This case has no evidence or events. Report will contain only cover page.
          </Text>
        )}

        {/* Result Actions */}
        {lastResult && !isGenerating && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Generated Report</Text>
            <View style={styles.resultInfo}>
              <Text style={styles.resultLabel}>Report ID:</Text>
              <Text style={styles.resultValue}>{lastResult.metadata.reportId}</Text>
            </View>
            <View style={styles.resultInfo}>
              <Text style={styles.resultLabel}>Generated:</Text>
              <Text style={styles.resultValue}>
                {new Date(lastResult.metadata.generatedAt).toLocaleString()}
              </Text>
            </View>
            <View style={styles.resultInfo}>
              <Text style={styles.resultLabel}>Evidence Items:</Text>
              <Text style={styles.resultValue}>{lastResult.metadata.evidenceCount}</Text>
            </View>
            <View style={styles.resultInfo}>
              <Text style={styles.resultLabel}>Events:</Text>
              <Text style={styles.resultValue}>{lastResult.metadata.eventCount}</Text>
            </View>
            <View style={styles.resultInfo}>
              <Text style={styles.resultLabel}>Manifest Hash:</Text>
              <Text style={styles.resultValue}>{lastResult.metadata.hashManifest.substring(0, 16)}...</Text>
            </View>
            <View style={styles.buttonRow}>
              <TouchableOpacity style={styles.secondaryButton} onPress={handleSaveManifest}>
                <Text style={styles.secondaryButtonText}>Save Manifest (.txt)</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.primaryButton} onPress={handleShare}>
                <Text style={styles.primaryButtonText}>Export / Share PDF</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Generation Status Toast */}
      {generationStatus && !isGenerating && (
        <View style={styles.toast}>
          <Text style={styles.toastText}>{generationStatus}</Text>
        </View>
      )}
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
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: palette.text,
    marginBottom: 8,
  },
  emptyDesc: {
    fontSize: 14,
    color: palette.textSecondary,
    textAlign: 'center',
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
  picker: {
    backgroundColor: palette.background,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: palette.text,
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
    gap: 8,
  },
  emptyWarning: {
    textAlign: 'center',
    fontSize: 12,
    color: '#f59e0b',
    marginBottom: 16,
    fontStyle: 'italic',
  },
  resultInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  resultLabel: {
    fontSize: 12,
    color: palette.textSecondary,
  },
  resultValue: {
    fontSize: 12,
    fontWeight: '600',
    color: palette.text,
    fontFamily: 'monospace',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  secondaryButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: palette.text,
    fontWeight: '600',
  },
  primaryButton: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: palette.primary,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
  toast: {
    position: 'absolute',
    bottom: 80,
    left: 16,
    right: 16,
    backgroundColor: palette.surface,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.primary,
    elevation: 4,
  },
  toastText: {
    textAlign: 'center',
    color: palette.primary,
    fontWeight: '600',
  },
});
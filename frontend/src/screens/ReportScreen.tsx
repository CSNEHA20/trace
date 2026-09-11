import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useCaseStore } from '../store/caseStore';
import { useEvidenceStore } from '../store/evidenceStore';
import { exportService } from '../services/exportService';
import { ExportPackageResult } from '../types';
import { AppHeader } from '../components/AppHeader';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { Colors, Spacing, Radius, Typography, Shadows } from '../theme';
import { Ionicons } from '@expo/vector-icons';

export function ReportScreen() {
  const activeCase = useCaseStore((state) => state.activeCase);
  const evidenceList = useEvidenceStore((state) => state.evidenceList);
  const [isExporting, setIsExporting] = useState(false);
  const [exportResult, setExportResult] = useState<ExportPackageResult | null>(null);

  const handleExport = async () => {
    if (!activeCase) return;
    setIsExporting(true);
    try {
      const res = await exportService.generateCaseReport(activeCase, evidenceList);
      setExportResult(res);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <View style={styles.container}>
      <AppHeader title="Forensic Export" subtitle="Generate Tamper-Proof PDF & Encrypted ZIP" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.caseBadge}>TARGET CASE</Text>
          <Text style={styles.caseTitle}>{activeCase?.title || 'Case TR-2026-0089'}</Text>
          <Text style={styles.caseMeta}>Case Number: {activeCase?.caseNumber || 'TR-2026-0089'}</Text>
          <Text style={styles.caseMeta}>Evidence Count: {evidenceList.length} items logged</Text>
        </View>

        <TouchableOpacity style={styles.exportBtn} onPress={handleExport} disabled={isExporting} activeOpacity={0.85}>
          <Ionicons name="document-text-outline" size={18} color="#ffffff" style={{ marginRight: 6 }} />
          <Text style={styles.exportBtnText}>
            {isExporting ? 'Generating Report...' : 'Build Forensic Evidence Package'}
          </Text>
        </TouchableOpacity>

        {isExporting ? <LoadingSpinner label="Building PDF report and computing SHA-256 ZIP package..." /> : null}

        {exportResult ? (
          <View style={styles.resultCard}>
            <Text style={styles.resultHeader}>Export Complete</Text>
            <Text style={styles.resultItem}>PDF Report: {exportResult.pdfUri}</Text>
            <Text style={styles.resultItem}>Encrypted ZIP: {exportResult.zipUri}</Text>
            <Text style={styles.resultItem}>Manifest SHA-256: {exportResult.manifestHash}</Text>
            <TouchableOpacity
              style={styles.shareBtn}
              onPress={() => exportService.shareReport(exportResult.pdfUri)}
              activeOpacity={0.85}
            >
              <Text style={styles.shareBtnText}>📄 Export / Share PDF</Text>
            </TouchableOpacity>
          </View>
        ) : null}
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
  card: {
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.lg,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: Colors.border,
    ...Shadows.elevated,
  },
  caseBadge: {
    ...Typography.subtopLabel,
    fontSize: 10,
    color: Colors.primary,
    marginBottom: 6,
  },
  caseTitle: {
    ...Typography.headline,
    fontSize: 20,
    color: Colors.ink,
    marginBottom: 6,
  },
  caseMeta: {
    ...Typography.body,
    fontSize: 13,
    color: Colors.textMuted,
    marginBottom: 3,
  },
  exportBtn: {
    flexDirection: 'row',
    backgroundColor: Colors.primary,
    padding: 16,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    ...Shadows.subtle,
  },
  exportBtnText: {
    ...Typography.bodyStrong,
    fontSize: 14,
    color: '#ffffff',
  },
  resultCard: {
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.lg,
    padding: 18,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderLeftWidth: 3.5,
    borderLeftColor: Colors.emerald,
    ...Shadows.elevated,
  },
  resultHeader: {
    ...Typography.subtopHeading,
    fontSize: 15,
    color: Colors.emerald,
    marginBottom: 10,
  },
  resultItem: {
    ...Typography.mono,
    fontSize: 12,
    color: Colors.ink,
    marginBottom: 6,
  },
  shareBtn: {
    backgroundColor: Colors.primary,
    marginTop: 14,
    paddingVertical: 14,
    borderRadius: Radius.md,
    alignItems: 'center',
  },
  shareBtnText: {
    ...Typography.bodyStrong,
    color: '#ffffff',
    fontSize: 14,
  },
});

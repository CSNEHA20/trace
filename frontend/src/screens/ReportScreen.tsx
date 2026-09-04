import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useCaseStore } from '../store/caseStore';
import { useEvidenceStore } from '../store/evidenceStore';
import { exportService, ExportPackageResult } from '../services/exportService';
import { AppHeader } from '../components/AppHeader';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { palette } from '../theme';

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
          <Text style={styles.caseTitle}>{activeCase?.title || 'Case TR-2026-0089'}</Text>
          <Text style={styles.caseMeta}>Case Number: {activeCase?.caseNumber || 'TR-2026-0089'}</Text>
          <Text style={styles.caseMeta}>Evidence Count: {evidenceList.length} items logged</Text>
        </View>

        <TouchableOpacity style={styles.exportBtn} onPress={handleExport} disabled={isExporting}>
          <Text style={styles.exportBtnText}>
            {isExporting ? 'Generating Report...' : 'Build Forensic Evidence Package'}
          </Text>
        </TouchableOpacity>

        {isExporting ? <LoadingSpinner label="Building PDF report and compute SHA-256 ZIP package..." /> : null}

        {exportResult ? (
          <View style={styles.resultCard}>
            <Text style={styles.resultHeader}>Export Complete</Text>
            <Text style={styles.resultItem}>PDF Report: {exportResult.pdfUri}</Text>
            <Text style={styles.resultItem}>Encrypted ZIP: {exportResult.zipUri}</Text>
            <Text style={styles.resultItem}>Manifest SHA-256: {exportResult.manifestHash}</Text>
          </View>
        ) : null}
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
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: palette.border,
  },
  caseTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: palette.text,
    marginBottom: 6,
  },
  caseMeta: {
    fontSize: 13,
    color: palette.textSecondary,
    marginBottom: 2,
  },
  exportBtn: {
    backgroundColor: palette.primary,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
  },
  exportBtnText: {
    fontSize: 15,
    fontWeight: 'bold',
    color: palette.background,
  },
  resultCard: {
    backgroundColor: palette.surfaceVariant,
    borderRadius: 10,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: palette.success,
  },
  resultHeader: {
    fontSize: 15,
    fontWeight: 'bold',
    color: palette.success,
    marginBottom: 8,
  },
  resultItem: {
    fontSize: 12,
    color: palette.text,
    fontFamily: 'monospace',
    marginBottom: 4,
  },
});

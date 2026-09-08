import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { palette } from '../theme';
import { useCaseStore } from '../store/caseStore';
import { useEvidenceStore } from '../store/evidenceStore';
import { databaseService } from '../services/databaseService';
import { verificationService } from '../services/verificationService';
import { forensicAnalysisService, CompleteForensicAnalysisResult } from '../services/forensicAnalysisService';
import { InferenceProgress } from '../../../ai/inference/inferenceService';
import { AppHeader } from '../components/AppHeader';
import { CaseCreateModal } from '../components/CaseCreateModal';
import { CaseSelectModal } from '../components/CaseSelectModal';
import { EvidenceSourcePicker, SourcePickerResult } from '../components/EvidenceSourcePicker';
import { IngestionProgressOverlay } from '../components/IngestionProgressOverlay';
import { NarrativeRecord, EventRecord, HashChainRecord, EvidenceItem } from '../types';

export function WorkspaceScreen() {
  const router = useRouter();
  const { cases, activeCase, fetchCases, selectCase } = useCaseStore();
  const { evidenceList, fetchEvidence, ingestEvidence, ingestionStatus, ingestionFilename } = useEvidenceStore();

  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  // Modals
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [selectModalVisible, setSelectModalVisible] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [overlayVisible, setOverlayVisible] = useState(false);

  // Analysis State
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState<InferenceProgress | null>(null);

  // Case Data from SQLite
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [narrative, setNarrative] = useState<NarrativeRecord | null>(null);
  const [chainRecords, setChainRecords] = useState<HashChainRecord[]>([]);
  const [chainIntegrityValid, setChainIntegrityValid] = useState<boolean | null>(null);
  const [verifiedEvidenceCount, setVerifiedEvidenceCount] = useState<number>(0);

  const loadCaseData = useCallback(async () => {
    if (!activeCase?.id) {
      setEvents([]);
      setNarrative(null);
      setChainRecords([]);
      setChainIntegrityValid(null);
      setVerifiedEvidenceCount(0);
      setLoading(false);
      return;
    }

    try {
      const [caseEvidence, caseEvents, caseNarrative, caseChain] = await Promise.all([
        databaseService.getEvidenceForCase(activeCase.id),
        databaseService.getEventsForCase(activeCase.id),
        databaseService.getLatestNarrativeForCase(activeCase.id),
        databaseService.getHashChainForCase(activeCase.id),
      ]);

      setEvents(caseEvents);
      setNarrative(caseNarrative);
      setChainRecords(caseChain);

      // Verify integrity for all evidence items
      let validCount = 0;
      let allValid = caseEvidence.length > 0;
      for (const ev of caseEvidence) {
        const v = await verificationService.verifyChain(ev.id);
        if (v.isValid) {
          validCount++;
        } else {
          allValid = false;
        }
      }

      setVerifiedEvidenceCount(validCount);
      setChainIntegrityValid(caseEvidence.length > 0 ? allValid : null);
    } catch (err) {
      console.error('[WorkspaceScreen] Error loading case data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeCase?.id]);

  useEffect(() => {
    fetchCases();
  }, []);

  useEffect(() => {
    if (activeCase?.id) {
      fetchEvidence(activeCase.id);
      loadCaseData();
    } else {
      setLoading(false);
    }
  }, [activeCase?.id, loadCaseData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchCases();
    if (activeCase?.id) {
      await fetchEvidence(activeCase.id);
      await loadCaseData();
    }
    setRefreshing(false);
  }, [activeCase?.id, fetchCases, fetchEvidence, loadCaseData]);

  // ── Evidence Import Handler ──────────────────────────────────────────
  const handleSourceSelected = async (result: SourcePickerResult) => {
    if (result.cancelled) return;
    if (result.permissionDenied) {
      Alert.alert('Permission Denied', 'Camera or Storage permission is required to ingest evidence.');
      return;
    }
    if (result.error) {
      Alert.alert('Import Error', result.error);
      return;
    }
    if (!result.uri || !activeCase?.id) {
      Alert.alert('No Active Case', 'Please select or create an active case first.');
      return;
    }

    setOverlayVisible(true);
    const res = await ingestEvidence({
      sourceUri: result.uri,
      originalFilename: result.filename,
      mimeType: result.mimeType,
      reportedSize: result.fileSize,
      source: result.source,
      caseId: activeCase.id,
    });
    setOverlayVisible(false);

    if (res.status === 'COMPLETE') {
      await fetchEvidence(activeCase.id);
      await loadCaseData();
    } else {
      Alert.alert('Ingestion Failed', res.error || 'Failed to ingest evidence into SQLite.');
    }
  };

  // ── Run On-Device Case Analysis ──────────────────────────────────────
  const handleAnalyzeCase = async () => {
    if (!activeCase?.id) {
      Alert.alert('No Case Selected', 'Select a case to analyze.');
      return;
    }
    if (evidenceList.length === 0) {
      Alert.alert('No Evidence', 'Add at least one piece of evidence before running analysis.');
      return;
    }

    setIsAnalyzing(true);
    setAnalysisProgress({
      stage: 'CHECKING',
      completedChunks: 0,
      totalChunks: 1,
      message: 'Checking local Gemma 2B model availability…',
    });

    try {
      await forensicAnalysisService.analyzeCaseEvidence(activeCase.id, {
        onProgress: (p) => setAnalysisProgress(p),
      });

      await fetchEvidence(activeCase.id);
      await loadCaseData();
      setIsAnalyzing(false);
      setAnalysisProgress(null);
      Alert.alert('Analysis Complete', 'Local forensic extraction finished and hash chain updated.');
    } catch (err: unknown) {
      setIsAnalyzing(false);
      setAnalysisProgress(null);
      Alert.alert('Analysis Failed', (err as Error)?.message || 'On-device Gemma analysis failed.');
    }
  };

  // ── Empty State ──────────────────────────────────────────────────────
  if (!loading && cases.length === 0) {
    return (
      <View style={styles.container}>
        <AppHeader title="TRACE FORENSIC WORKSPACE" subtitle="Offline On-Device Digital Forensics" />
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>🛡️</Text>
          <Text style={styles.emptyTitle}>No Forensic Case Created</Text>
          <Text style={styles.emptyText}>
            TRACE requires an authoritative SQLite case file to securely ingest evidence and record hash-chain ledger events.
          </Text>
          <TouchableOpacity style={styles.primaryActionBtn} onPress={() => setCreateModalVisible(true)}>
            <Text style={styles.primaryActionBtnText}>+ Initialize Forensic Case</Text>
          </TouchableOpacity>
        </View>

        <CaseCreateModal
          visible={createModalVisible}
          onClose={() => setCreateModalVisible(false)}
          onCaseCreated={async (id) => {
            await selectCase(id);
            await fetchCases();
          }}
        />
      </View>
    );
  }

  const lastChainNode = chainRecords.length > 0 ? chainRecords[chainRecords.length - 1] : null;

  return (
    <View style={styles.container}>
      <AppHeader
        title="TRACE FORENSIC WORKSPACE"
        subtitle="Hardware-Backed On-Device Digital Forensics"
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[palette.primary]} />
        }
      >
        {/* Offline & Architecture Banner */}
        <View style={styles.securityBanner}>
          <View style={styles.securityBadge}>
            <Text style={styles.securityBadgeDot}>●</Text>
            <Text style={styles.securityBadgeText}>100% OFFLINE / LOCAL AI</Text>
          </View>
          <Text style={styles.securitySubtext}>
            Gemma 2B CPU INT4 · MediaPipe GenAI Runtime · SQLite Hash-Chain
          </Text>
        </View>

        {/* ── CASE HEADER ── */}
        <View style={styles.caseHeaderCard}>
          <View style={styles.caseHeaderTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.caseNumberLabel}>{activeCase?.caseNumber || 'NO CASE'}</Text>
              <Text style={styles.caseTitleText} numberOfLines={2}>
                {activeCase?.title || 'Untitled Case'}
              </Text>
            </View>
            <TouchableOpacity style={styles.switchCaseBtn} onPress={() => setSelectModalVisible(true)}>
              <Text style={styles.switchCaseBtnText}>Switch Case</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.caseMetaDivider} />

          <View style={styles.caseMetaRow}>
            <View style={styles.metaCol}>
              <Text style={styles.metaLabel}>INVESTIGATOR</Text>
              <Text style={styles.metaValue}>{activeCase?.investigatorName || 'Unknown'}</Text>
            </View>
            <View style={styles.metaCol}>
              <Text style={styles.metaLabel}>EVIDENCE ITEMS</Text>
              <Text style={styles.metaValue}>{evidenceList.length} items</Text>
            </View>
            <View style={styles.metaCol}>
              <Text style={styles.metaLabel}>INTEGRITY</Text>
              <Text
                style={[
                  styles.metaValue,
                  {
                    color:
                      chainIntegrityValid === true
                        ? palette.success
                        : chainIntegrityValid === false
                        ? palette.error
                        : palette.textSecondary,
                  },
                ]}
              >
                {chainIntegrityValid === true
                  ? 'VERIFIED'
                  : chainIntegrityValid === false
                  ? 'TAMPERED'
                  : 'PENDING'}
              </Text>
            </View>
          </View>
        </View>

        {/* ── CASE OVERVIEW 3-TIER ── */}
        <View style={styles.overviewGrid}>
          <View style={styles.overviewBox}>
            <Text style={styles.overviewBoxTitle}>EVIDENCE</Text>
            <Text style={styles.overviewBoxBig}>{evidenceList.length}</Text>
            <Text style={styles.overviewBoxSub}>
              {verifiedEvidenceCount} / {evidenceList.length} verified
            </Text>
          </View>

          <View style={styles.overviewBox}>
            <Text style={styles.overviewBoxTitle}>ANALYSIS</Text>
            <Text
              style={[
                styles.overviewBoxBig,
                { color: narrative ? palette.primary : palette.warning, fontSize: 16, marginTop: 4 },
              ]}
            >
              {narrative ? 'COMPLETE' : 'PENDING'}
            </Text>
            <Text style={styles.overviewBoxSub}>
              {narrative ? 'Gemma extracted' : 'Awaiting run'}
            </Text>
          </View>

          <View style={styles.overviewBox}>
            <Text style={styles.overviewBoxTitle}>CHAIN</Text>
            <Text
              style={[
                styles.overviewBoxBig,
                {
                  color:
                    chainIntegrityValid === true
                      ? palette.success
                      : chainIntegrityValid === false
                      ? palette.error
                      : palette.textSecondary,
                  fontSize: 16,
                  marginTop: 4,
                },
              ]}
            >
              {chainIntegrityValid === true ? 'VALID' : chainIntegrityValid === false ? 'ALERT' : 'EMPTY'}
            </Text>
            <Text style={styles.overviewBoxSub}>{chainRecords.length} nodes</Text>
          </View>
        </View>

        {/* ── ANALYSIS IN PROGRESS NOTIFICATION ── */}
        {isAnalyzing && (
          <View style={styles.analysisProgressCard}>
            <View style={styles.analysisProgressHeader}>
              <ActivityIndicator size="small" color={palette.primary} />
              <Text style={styles.analysisProgressTitle}>
                STAGE: {analysisProgress?.stage || 'ANALYZING'}
              </Text>
            </View>
            <Text style={styles.analysisProgressMsg}>{analysisProgress?.message}</Text>
          </View>
        )}

        {/* ── QUICK ACTIONS ── */}
        <Text style={styles.sectionHeader}>QUICK ACTIONS</Text>
        <View style={styles.actionsGrid}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => setPickerVisible(true)}>
            <Text style={styles.actionBtnIcon}>➕</Text>
            <Text style={styles.actionBtnText}>Add Evidence</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, isAnalyzing && styles.actionBtnDisabled]}
            onPress={handleAnalyzeCase}
            disabled={isAnalyzing}
          >
            <Text style={styles.actionBtnIcon}>⚡</Text>
            <Text style={styles.actionBtnText}>
              {isAnalyzing ? 'Analyzing…' : 'Analyze Case'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionBtn} onPress={() => router.push('/(tabs)/timeline')}>
            <Text style={styles.actionBtnIcon}>⏳</Text>
            <Text style={styles.actionBtnText}>View Timeline</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionBtn} onPress={() => router.push('/(tabs)/findings')}>
            <Text style={styles.actionBtnIcon}>🔍</Text>
            <Text style={styles.actionBtnText}>View Findings</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionBtn} onPress={() => router.push('/(tabs)/integrity')}>
            <Text style={styles.actionBtnIcon}>🔐</Text>
            <Text style={styles.actionBtnText}>Integrity Ledger</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionBtn} onPress={() => router.push('/(tabs)/report')}>
            <Text style={styles.actionBtnIcon}>📄</Text>
            <Text style={styles.actionBtnText}>Export Report</Text>
          </TouchableOpacity>
        </View>

        {/* ── LATEST FORENSIC FINDINGS SUMMARY ── */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeader}>LATEST FINDINGS</Text>
          {narrative && (
            <TouchableOpacity onPress={() => router.push('/(tabs)/findings')}>
              <Text style={styles.viewAllLink}>View All Findings →</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.card}>
          {narrative ? (
            <View>
              <Text style={styles.findingSummaryHeader}>INCIDENT NARRATIVE SUMMARY</Text>
              <Text style={styles.findingNarrativeText} numberOfLines={4}>
                {narrative.content.split('### Extracted Facts')[0].replace(/### Incident Summary/g, '').trim()}
              </Text>
              <View style={styles.findingsCounterRow}>
                <View style={styles.findingCountTag}>
                  <Text style={styles.findingCountLabel}>EVENTS</Text>
                  <Text style={styles.findingCountValue}>{events.length}</Text>
                </View>
                <View style={styles.findingCountTag}>
                  <Text style={styles.findingCountLabel}>LEDGER PROOFS</Text>
                  <Text style={styles.findingCountValue}>{chainRecords.length}</Text>
                </View>
                <View style={styles.findingCountTag}>
                  <Text style={styles.findingCountLabel}>MODEL</Text>
                  <Text style={styles.findingCountValue}>GEMMA 2B</Text>
                </View>
              </View>
            </View>
          ) : (
            <View style={styles.emptyFindingsBox}>
              <Text style={styles.emptyFindingsText}>No forensic analysis generated yet.</Text>
              <Text style={styles.emptyFindingsSub}>
                Execute on-device Gemma analysis to extract verified timeline events and threats.
              </Text>
            </View>
          )}
        </View>

        {/* ── INTEGRITY SUMMARY ── */}
        <Text style={styles.sectionHeader}>INTEGRITY & PROVENANCE</Text>
        <View style={styles.card}>
          <View style={styles.integrityRow}>
            <Text style={styles.integrityLabel}>Evidence Hashes:</Text>
            <Text style={styles.integrityValue}>
              {verifiedEvidenceCount} / {evidenceList.length} SHA-256 Verified
            </Text>
          </View>
          <View style={styles.integrityRow}>
            <Text style={styles.integrityLabel}>Last Chain Event:</Text>
            <Text style={styles.integrityValue}>
              {lastChainNode ? `${lastChainNode.operation} (#${chainRecords.length})` : 'None recorded'}
            </Text>
          </View>
          <View style={styles.integrityRow}>
            <Text style={styles.integrityLabel}>Ledger Status:</Text>
            <Text
              style={[
                styles.integrityValue,
                {
                  color:
                    chainIntegrityValid === true
                      ? palette.success
                      : chainIntegrityValid === false
                      ? palette.error
                      : palette.textSecondary,
                  fontWeight: 'bold',
                },
              ]}
            >
              {chainIntegrityValid === true
                ? 'CRYPTOGRAPHICALLY VALID'
                : chainIntegrityValid === false
                ? 'INTEGRITY MISMATCH DETECTED'
                : 'AWAITING EVIDENCE'}
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Modals & Pickers */}
      <CaseCreateModal
        visible={createModalVisible}
        onClose={() => setCreateModalVisible(false)}
        onCaseCreated={async (id) => {
          await selectCase(id);
          await fetchCases();
        }}
      />

      <CaseSelectModal
        visible={selectModalVisible}
        cases={cases}
        activeCaseId={activeCase?.id}
        onClose={() => setSelectModalVisible(false)}
        onSelectCase={async (id) => {
          await selectCase(id);
        }}
        onCreateNewPress={() => setCreateModalVisible(true)}
      />

      <EvidenceSourcePicker
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
        onSourceSelected={handleSourceSelected}
      />

      <IngestionProgressOverlay
        visible={overlayVisible}
        status={ingestionStatus || 'PENDING'}
        fileName={ingestionFilename || 'evidence file'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  securityBanner: {
    backgroundColor: 'rgba(0, 242, 254, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(0, 242, 254, 0.2)',
    borderRadius: 8,
    padding: 10,
    marginBottom: 14,
  },
  securityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  securityBadgeDot: {
    color: palette.primary,
    fontSize: 10,
  },
  securityBadgeText: {
    color: palette.primary,
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 0.8,
  },
  securitySubtext: {
    color: palette.textSecondary,
    fontSize: 10,
  },
  caseHeaderCard: {
    backgroundColor: palette.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 16,
    marginBottom: 14,
  },
  caseHeaderTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  caseNumberLabel: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: palette.secondary,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  caseTitleText: {
    fontSize: 17,
    fontWeight: 'bold',
    color: palette.text,
  },
  switchCaseBtn: {
    backgroundColor: palette.surfaceVariant,
    borderWidth: 1,
    borderColor: palette.border,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  switchCaseBtnText: {
    color: palette.primary,
    fontSize: 12,
    fontWeight: 'bold',
  },
  caseMetaDivider: {
    height: 1,
    backgroundColor: palette.border,
    marginVertical: 12,
  },
  caseMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metaCol: {
    flex: 1,
  },
  metaLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    color: palette.textSecondary,
    marginBottom: 2,
  },
  metaValue: {
    fontSize: 12,
    fontWeight: '600',
    color: palette.text,
  },
  overviewGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  overviewBox: {
    flex: 1,
    backgroundColor: palette.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 12,
    alignItems: 'center',
  },
  overviewBoxTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: palette.textSecondary,
    letterSpacing: 0.5,
  },
  overviewBoxBig: {
    fontSize: 22,
    fontWeight: 'bold',
    color: palette.text,
    marginVertical: 2,
  },
  overviewBoxSub: {
    fontSize: 10,
    color: palette.textSecondary,
  },
  analysisProgressCard: {
    backgroundColor: 'rgba(0, 242, 254, 0.08)',
    borderWidth: 1,
    borderColor: palette.primary,
    borderRadius: 10,
    padding: 14,
    marginBottom: 14,
  },
  analysisProgressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  analysisProgressTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: palette.primary,
    fontFamily: 'monospace',
  },
  analysisProgressMsg: {
    fontSize: 12,
    color: palette.text,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: 'bold',
    color: palette.textSecondary,
    letterSpacing: 0.8,
    marginBottom: 8,
    marginTop: 4,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    marginTop: 4,
  },
  viewAllLink: {
    color: palette.primary,
    fontSize: 12,
    fontWeight: 'bold',
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  actionBtn: {
    flexBasis: '31%',
    flexGrow: 1,
    backgroundColor: palette.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: palette.border,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnDisabled: {
    opacity: 0.6,
  },
  actionBtnIcon: {
    fontSize: 18,
    marginBottom: 4,
  },
  actionBtnText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: palette.text,
  },
  card: {
    backgroundColor: palette.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 14,
    marginBottom: 14,
  },
  findingSummaryHeader: {
    fontSize: 11,
    fontWeight: 'bold',
    color: palette.primary,
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  findingNarrativeText: {
    fontSize: 13,
    color: palette.text,
    lineHeight: 18,
    marginBottom: 12,
  },
  findingsCounterRow: {
    flexDirection: 'row',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: palette.border,
    paddingTop: 10,
  },
  findingCountTag: {
    flex: 1,
    backgroundColor: palette.surfaceVariant,
    padding: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  findingCountLabel: {
    fontSize: 9,
    fontWeight: 'bold',
    color: palette.textSecondary,
  },
  findingCountValue: {
    fontSize: 12,
    fontWeight: 'bold',
    color: palette.text,
    marginTop: 2,
  },
  emptyFindingsBox: {
    padding: 16,
    alignItems: 'center',
  },
  emptyFindingsText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: palette.textSecondary,
    marginBottom: 4,
  },
  emptyFindingsSub: {
    fontSize: 11,
    color: palette.textSecondary,
    textAlign: 'center',
    lineHeight: 16,
  },
  integrityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  integrityLabel: {
    fontSize: 12,
    color: palette.textSecondary,
  },
  integrityValue: {
    fontSize: 12,
    color: palette.text,
    fontFamily: 'monospace',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: palette.text,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 13,
    color: palette.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  primaryActionBtn: {
    backgroundColor: palette.primary,
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  primaryActionBtnText: {
    color: '#041018',
    fontSize: 14,
    fontWeight: 'bold',
  },
});

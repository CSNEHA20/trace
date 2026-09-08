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

  useEffect(() => {
    let mounted = true;
    const checkPendingCameraCapture = async () => {
      try {
        const ImagePicker = require('expo-image-picker');
        if (ImagePicker && typeof ImagePicker.getPendingResultAsync === 'function') {
          const pending = await ImagePicker.getPendingResultAsync();
          if (Array.isArray(pending) && pending.length > 0 && mounted) {
            for (const item of pending) {
              if (item && !item.canceled && item.assets && item.assets[0]?.uri) {
                const asset = item.assets[0];
                const targetCase = activeCase || cases[0];
                if (targetCase?.id) {
                  setOverlayVisible(true);
                  await ingestEvidence({
                    sourceUri: asset.uri,
                    originalFilename: asset.fileName || `camera_recovered_${Date.now()}.jpg`,
                    mimeType: asset.mimeType || 'image/jpeg',
                    reportedSize: asset.fileSize,
                    source: 'CAMERA',
                    caseId: targetCase.id,
                  });
                  setOverlayVisible(false);
                  await fetchEvidence(targetCase.id);
                  await loadCaseData();
                }
              }
            }
          }
        }
      } catch {
        // Silent check on mount
      }
    };
    checkPendingCameraCapture();
    return () => {
      mounted = false;
    };
  }, [activeCase?.id, cases.length]);

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
    try {
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
    } catch (err: unknown) {
      setOverlayVisible(false);
      Alert.alert('Ingestion Error', (err as Error)?.message || 'Failed to complete evidence intake.');
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
      const msg = (err as Error)?.message || '';
      Alert.alert('Analysis Failed', msg || 'On-device forensic analysis failed.');
    }
  };

  // ── Loading State ────────────────────────────────────────────────────
  if (loading && !activeCase) {
    return (
      <View style={styles.container}>
        <AppHeader title="TRACE FORENSIC WORKSPACE" subtitle="Hardware-Backed On-Device Digital Forensics" />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={palette.brandYellow} />
          <Text style={{ marginTop: 12, color: palette.textSecondary, fontSize: 13, fontWeight: '500' }}>
            Initializing forensic workspace…
          </Text>
        </View>
      </View>
    );
  }

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
    backgroundColor: 'rgba(245, 166, 35, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(245, 166, 35, 0.3)',
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
    color: palette.brandYellow,
    fontSize: 10,
  },
  securityBadgeText: {
    color: palette.deepBlack,
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
    borderWidth: 1.5,
    borderColor: palette.borderDark,
    borderLeftWidth: 4,
    borderLeftColor: palette.brandYellow,
    padding: 16,
    marginBottom: 14,
    elevation: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
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
    color: palette.deepBlack,
    fontWeight: '900',
    marginBottom: 2,
  },
  caseTitleText: {
    fontSize: 18,
    fontWeight: '900',
    color: palette.deepBlack,
  },
  switchCaseBtn: {
    backgroundColor: palette.deepBlack,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  switchCaseBtnText: {
    color: palette.white,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
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
    fontWeight: '800',
    color: palette.textSecondary,
    marginBottom: 2,
    letterSpacing: 0.5,
  },
  metaValue: {
    fontSize: 13,
    fontWeight: '800',
    color: palette.deepBlack,
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
    borderWidth: 1.5,
    borderColor: palette.borderDark,
    padding: 12,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
  },
  overviewBoxTitle: {
    fontSize: 10,
    fontWeight: '900',
    color: palette.deepBlack,
    letterSpacing: 0.5,
  },
  overviewBoxBig: {
    fontSize: 22,
    fontWeight: '900',
    color: palette.deepBlack,
    marginVertical: 2,
  },
  overviewBoxSub: {
    fontSize: 10,
    fontWeight: '600',
    color: palette.textSecondary,
  },
  analysisProgressCard: {
    backgroundColor: 'rgba(245, 166, 35, 0.08)',
    borderWidth: 1.5,
    borderColor: palette.brandYellow,
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
    fontWeight: '900',
    color: palette.deepBlack,
    fontFamily: 'monospace',
  },
  analysisProgressMsg: {
    fontSize: 12,
    fontWeight: '600',
    color: palette.textSecondary,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '900',
    color: palette.deepBlack,
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
    color: palette.deepBlack,
    fontSize: 12,
    fontWeight: '800',
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
    borderWidth: 1.5,
    borderColor: palette.borderDark,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
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
    fontWeight: '800',
    color: palette.deepBlack,
  },
  card: {
    backgroundColor: palette.surface,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: palette.borderDark,
    borderLeftWidth: 4,
    borderLeftColor: palette.brandYellow,
    padding: 14,
    marginBottom: 14,
    elevation: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
  },
  findingSummaryHeader: {
    fontSize: 12,
    fontWeight: '900',
    color: palette.deepBlack,
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  findingNarrativeText: {
    fontSize: 13,
    color: palette.deepBlack,
    lineHeight: 18,
    marginBottom: 12,
    fontWeight: '500',
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
    borderWidth: 1.5,
    borderColor: palette.borderDark,
  },
  findingCountLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: palette.textSecondary,
    letterSpacing: 0.3,
  },
  findingCountValue: {
    fontSize: 14,
    fontWeight: '900',
    color: palette.deepBlack,
    marginTop: 2,
  },
  emptyFindingsBox: {
    padding: 16,
    alignItems: 'center',
  },
  emptyFindingsText: {
    fontSize: 13,
    fontWeight: '800',
    color: palette.deepBlack,
    marginBottom: 4,
  },
  emptyFindingsSub: {
    fontSize: 11,
    color: palette.textSecondary,
    textAlign: 'center',
    lineHeight: 16,
    fontWeight: '600',
  },
  integrityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  integrityLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: palette.textSecondary,
  },
  integrityValue: {
    fontSize: 12,
    color: palette.deepBlack,
    fontFamily: 'monospace',
    fontWeight: '700',
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
    fontWeight: '900',
    color: palette.deepBlack,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 13,
    color: palette.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    fontWeight: '500',
    marginBottom: 24,
  },
  primaryActionBtn: {
    backgroundColor: palette.deepBlack,
    borderRadius: 10,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderLeftWidth: 4,
    borderLeftColor: palette.brandYellow,
    elevation: 3,
  },
  primaryActionBtnText: {
    color: palette.white,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});

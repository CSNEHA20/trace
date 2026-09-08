import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useCaseStore } from '../store/caseStore';
import { databaseService } from '../services/databaseService';
import { verificationService } from '../services/verificationService';
import { AppHeader } from '../components/AppHeader';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { EmptyState } from '../components/EmptyState';
import { palette } from '../theme';
import { formatDate, formatHashShort } from '../utils/crypto';
import { HashChainRecord, EvidenceItem } from '../types';
import { ChainVerificationResult } from '../types/integrity';

export function IntegrityScreen() {
  const activeCase = useCaseStore((state) => state.activeCase);

  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isVerifyingAll, setIsVerifyingAll] = useState(false);

  const [evidenceList, setEvidenceList] = useState<EvidenceItem[]>([]);
  const [chainNodes, setChainNodes] = useState<HashChainRecord[]>([]);
  const [verificationMap, setVerificationMap] = useState<Record<string, ChainVerificationResult>>({});
  const [overallValid, setOverallValid] = useState<boolean | null>(null);

  const loadIntegrityData = useCallback(async () => {
    if (!activeCase?.id) {
      setEvidenceList([]);
      setChainNodes([]);
      setVerificationMap({});
      setOverallValid(null);
      setIsLoading(false);
      return;
    }

    try {
      const [evidence, chain] = await Promise.all([
        databaseService.getEvidenceForCase(activeCase.id),
        databaseService.getHashChainForCase(activeCase.id),
      ]);

      setEvidenceList(evidence);
      setChainNodes(chain);

      // Verify each evidence chain
      const vMap: Record<string, ChainVerificationResult> = {};
      let allGood = evidence.length > 0;
      for (const ev of evidence) {
        const v = await verificationService.verifyChain(ev.id);
        vMap[ev.id] = v;
        if (!v.isValid) allGood = false;
      }

      setVerificationMap(vMap);
      setOverallValid(evidence.length > 0 ? allGood : null);
    } catch (err) {
      console.error('[IntegrityScreen] Error loading integrity data:', err);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [activeCase?.id]);

  useEffect(() => {
    setIsLoading(true);
    loadIntegrityData();
  }, [loadIntegrityData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadIntegrityData();
  }, [loadIntegrityData]);

  const handleVerifyAll = async () => {
    setIsVerifyingAll(true);
    await loadIntegrityData();
    setIsVerifyingAll(false);
  };

  const verifiedCount = evidenceList.filter((e) => verificationMap[e.id]?.isValid).length;
  const lastNode = chainNodes.length > 0 ? chainNodes[chainNodes.length - 1] : null;

  return (
    <View style={styles.container}>
      <AppHeader
        title="INTEGRITY LEDGER"
        subtitle={`Cryptographic Verification · Case ${activeCase?.caseNumber || 'N/A'}`}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[palette.primary]} />
        }
      >
        {/* Banner */}
        <View style={styles.banner}>
          <Text style={styles.bannerTitle}>TAMPER-EVIDENT CRYPTOGRAPHIC HASH CHAIN</Text>
          <Text style={styles.bannerText}>
            Every import, transformation, OCR, transcription, and Gemma analysis operation is cryptographically hashed and chained to form an immutable forensic ledger.
          </Text>
        </View>

        {isLoading ? (
          <LoadingSpinner label="Auditing cryptographic hash chain…" />
        ) : evidenceList.length === 0 ? (
          <EmptyState
            title="No Evidence Ingested"
            message="Ingest evidence to create genesis hash chain nodes and track forensic integrity."
          />
        ) : (
          <>
            {/* ── HIGH-LEVEL INTEGRITY CARD ── */}
            <View style={styles.overviewCard}>
              <View style={styles.statusHeaderRow}>
                <Text style={styles.overviewTitle}>OVERALL CASE INTEGRITY</Text>
                <View
                  style={[
                    styles.statusBadge,
                    {
                      borderColor:
                        overallValid === true
                          ? palette.success
                          : overallValid === false
                          ? palette.error
                          : palette.textSecondary,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusBadgeText,
                      {
                        color:
                          overallValid === true
                            ? palette.success
                            : overallValid === false
                            ? palette.error
                            : palette.textSecondary,
                      },
                    ]}
                  >
                    {overallValid === true ? 'VERIFIED' : overallValid === false ? 'TAMPERED' : 'PENDING'}
                  </Text>
                </View>
              </View>

              <View style={styles.statGrid}>
                <View style={styles.statBox}>
                  <Text style={styles.statBoxLabel}>EVIDENCE INTEGRITY</Text>
                  <Text style={styles.statBoxValue}>
                    {verifiedCount} / {evidenceList.length}
                  </Text>
                  <Text style={styles.statBoxSub}>Verified items</Text>
                </View>

                <View style={styles.statBox}>
                  <Text style={styles.statBoxLabel}>HASH CHAIN</Text>
                  <Text
                    style={[
                      styles.statBoxValue,
                      { color: overallValid ? palette.success : palette.error },
                    ]}
                  >
                    {overallValid ? 'VALID' : 'ALERT'}
                  </Text>
                  <Text style={styles.statBoxSub}>{chainNodes.length} ledger nodes</Text>
                </View>

                <View style={styles.statBox}>
                  <Text style={styles.statBoxLabel}>LAST EVENT</Text>
                  <Text style={[styles.statBoxValue, { fontSize: 13, marginTop: 4 }]}>
                    {lastNode?.operation || 'NONE'}
                  </Text>
                  <Text style={styles.statBoxSub}>Position #{chainNodes.length}</Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.verifyBtn}
                onPress={handleVerifyAll}
                disabled={isVerifyingAll}
              >
                {isVerifyingAll ? (
                  <ActivityIndicator size="small" color={palette.white} />
                ) : (
                  <Text style={styles.verifyBtnText}>Re-Verify Entire Hash Chain</Text>
                )}
              </TouchableOpacity>
            </View>

            {/* ── EVIDENCE ITEM INTEGRITY AUDIT ── */}
            <Text style={styles.sectionHeader}>EVIDENCE ITEMS AUDIT</Text>
            {evidenceList.map((ev) => {
              const vResult = verificationMap[ev.id];
              const isValid = vResult?.isValid;

              return (
                <View key={ev.id} style={styles.evidenceAuditCard}>
                  <View style={styles.evidenceAuditTop}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.evidenceAuditTitle} numberOfLines={1}>
                        {ev.fileName}
                      </Text>
                      <Text style={styles.evidenceAuditId}>ID: {ev.id}</Text>
                    </View>
                    <View
                      style={[
                        styles.miniBadge,
                        { borderColor: isValid ? palette.success : palette.error },
                      ]}
                    >
                      <Text style={{ color: isValid ? palette.success : palette.error, fontSize: 10, fontWeight: 'bold' }}>
                        {isValid ? 'VALID' : 'TAMPERED'}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.monoHashLabel}>SHA-256 Import Hash:</Text>
                  <Text style={styles.monoHashValue} selectable>{ev.sha256Hash}</Text>

                  <View style={styles.evidenceAuditFooter}>
                    <Text style={styles.evidenceAuditMeta}>
                      Nodes: {vResult?.nodeCount || 0} · Verified: {vResult?.verifiedAt ? formatDate(vResult.verifiedAt) : 'Never'}
                    </Text>
                  </View>
                </View>
              );
            })}

            {/* ── COMPLETE LEDGER NODE LIST ── */}
            <Text style={styles.sectionHeader}>HASH CHAIN LEDGER NODES ({chainNodes.length})</Text>
            {chainNodes.length === 0 ? (
              <View style={styles.emptyCategoryCard}>
                <Text style={styles.emptyCategoryText}>No ledger nodes recorded yet.</Text>
              </View>
            ) : (
              chainNodes.map((node, idx) => (
                <View key={node.id} style={styles.nodeCard}>
                  <View style={styles.nodeCardHeader}>
                    <Text style={styles.nodePosBadge}>#{idx + 1}</Text>
                    <Text style={styles.nodeOpBadge}>{node.operation}</Text>
                    <Text style={styles.nodeTime}>{formatDate(node.timestamp)}</Text>
                  </View>

                  <Text style={styles.nodeLabel}>PAYLOAD HASH:</Text>
                  <Text style={styles.nodeMono} selectable>{node.payload_hash}</Text>

                  <Text style={styles.nodeLabel}>CHAIN HASH:</Text>
                  <Text style={styles.nodeMono} selectable>{node.chain_hash}</Text>

                  <Text style={styles.nodeEvidenceRef}>
                    Evidence ID: <Text style={{ color: palette.brandAmber }}>{node.evidence_id}</Text>
                  </Text>
                </View>
              ))
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.background },
  scrollView: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  banner: {
    backgroundColor: palette.card,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: palette.borderDark,
    borderLeftWidth: 4,
    borderLeftColor: palette.brandYellow,
    marginBottom: 14,
  },
  bannerTitle: { fontSize: 11, fontWeight: '900', color: palette.deepBlack, marginBottom: 2, letterSpacing: 0.6 },
  bannerText: { fontSize: 11, color: palette.textSecondary, lineHeight: 16, fontWeight: '500' },
  overviewCard: {
    backgroundColor: palette.surface,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: palette.borderDark,
    borderLeftWidth: 4,
    borderLeftColor: palette.brandYellow,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
  },
  statusHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  overviewTitle: { fontSize: 12, fontWeight: '900', color: palette.deepBlack, letterSpacing: 0.8 },
  statusBadge: {
    borderWidth: 1.5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  statusBadgeText: { fontSize: 11, fontWeight: '900', letterSpacing: 0.6 },
  statGrid: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  statBox: {
    flex: 1,
    backgroundColor: palette.surfaceVariant,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: palette.borderDark,
    padding: 10,
    alignItems: 'center',
  },
  statBoxLabel: { fontSize: 9, fontWeight: '800', color: palette.textSecondary, letterSpacing: 0.5 },
  statBoxValue: { fontSize: 18, fontWeight: '900', color: palette.deepBlack, marginVertical: 2 },
  statBoxSub: { fontSize: 9, fontWeight: '600', color: palette.textSecondary },
  verifyBtn: {
    backgroundColor: palette.deepBlack,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    borderLeftWidth: 4,
    borderLeftColor: palette.brandYellow,
    elevation: 3,
  },
  verifyBtnText: { color: palette.white, fontSize: 13, fontWeight: '800', letterSpacing: 0.5 },
  sectionHeader: { fontSize: 12, fontWeight: '900', color: palette.deepBlack, letterSpacing: 0.8, marginBottom: 8, marginTop: 4 },
  evidenceAuditCard: {
    backgroundColor: palette.surface,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: palette.borderDark,
    borderLeftWidth: 4,
    borderLeftColor: palette.brandYellow,
    padding: 12,
    marginBottom: 10,
    elevation: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
  },
  evidenceAuditTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  evidenceAuditTitle: { fontSize: 14, fontWeight: '900', color: palette.deepBlack },
  evidenceAuditId: { fontSize: 10, fontFamily: 'monospace', color: palette.textSecondary, fontWeight: '600' },
  miniBadge: { borderWidth: 1.5, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  monoHashLabel: { fontSize: 10, fontWeight: '800', color: palette.deepBlack, marginTop: 4 },
  monoHashValue: { fontSize: 11, fontFamily: 'monospace', color: palette.deepBlack, fontWeight: '600', marginBottom: 4 },
  evidenceAuditFooter: { borderTopWidth: 1, borderTopColor: palette.border, paddingTop: 6, marginTop: 4 },
  evidenceAuditMeta: { fontSize: 10, fontWeight: '600', color: palette.textSecondary },
  nodeCard: {
    backgroundColor: palette.surface,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: palette.borderDark,
    padding: 12,
    marginBottom: 10,
    elevation: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
  },
  nodeCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  nodePosBadge: {
    backgroundColor: palette.brandYellow,
    color: palette.deepBlack,
    fontWeight: '900',
    fontSize: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  nodeOpBadge: {
    backgroundColor: palette.deepBlack,
    color: palette.white,
    fontWeight: '800',
    fontSize: 11,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  nodeTime: { fontSize: 10, color: palette.textSecondary, marginLeft: 'auto', fontWeight: '600' },
  nodeLabel: { fontSize: 9, fontWeight: '800', color: palette.textSecondary, marginTop: 4 },
  nodeMono: { fontSize: 10, fontFamily: 'monospace', color: palette.deepBlack, marginBottom: 2, fontWeight: '600' },
  nodeEvidenceRef: { fontSize: 10, color: palette.textSecondary, marginTop: 4, fontWeight: '600' },
  emptyCategoryCard: { backgroundColor: palette.surface, borderRadius: 8, borderWidth: 1.5, borderColor: palette.borderDark, padding: 12, alignItems: 'center' },
  emptyCategoryText: { fontSize: 12, color: palette.textSecondary, fontWeight: '600' },
});

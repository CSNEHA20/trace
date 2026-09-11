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
import { Colors, Spacing, Radius, Typography, Shadows } from '../theme';
import { formatDate, formatHashShort } from '../utils/crypto';
import { HashChainRecord, EvidenceItem } from '../types';
import { ChainVerificationResult } from '../types/integrity';
import { Ionicons } from '@expo/vector-icons';

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
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />
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
                          ? Colors.emerald
                          : overallValid === false
                          ? Colors.crimson
                          : Colors.textMuted,
                      backgroundColor:
                        overallValid === true
                          ? 'rgba(5, 150, 105, 0.12)'
                          : overallValid === false
                          ? 'rgba(220, 38, 38, 0.12)'
                          : Colors.surface,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusBadgeText,
                      {
                        color:
                          overallValid === true
                            ? Colors.emerald
                            : overallValid === false
                            ? Colors.crimson
                            : Colors.textMuted,
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
                      { color: overallValid ? Colors.emerald : Colors.crimson },
                    ]}
                  >
                    {overallValid ? 'VALID' : 'ALERT'}
                  </Text>
                  <Text style={styles.statBoxSub}>{chainNodes.length} ledger nodes</Text>
                </View>

                <View style={styles.statBox}>
                  <Text style={styles.statBoxLabel}>LAST EVENT</Text>
                  <Text style={[styles.statBoxValue, { fontSize: 13, marginTop: 4 }]} numberOfLines={1}>
                    {lastNode?.operation || 'NONE'}
                  </Text>
                  <Text style={styles.statBoxSub}>Position #{chainNodes.length}</Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.verifyBtn}
                onPress={handleVerifyAll}
                disabled={isVerifyingAll}
                activeOpacity={0.85}
              >
                {isVerifyingAll ? (
                  <ActivityIndicator size="small" color="#ffffff" />
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
                        {
                          borderColor: isValid ? Colors.emerald : Colors.crimson,
                          backgroundColor: isValid ? 'rgba(5, 150, 105, 0.12)' : 'rgba(220, 38, 38, 0.12)',
                        },
                      ]}
                    >
                      <Text style={{ color: isValid ? Colors.emerald : Colors.crimson, fontSize: 10, fontWeight: 'bold' }}>
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
                    Evidence ID: <Text style={{ color: Colors.primary }}>{node.evidence_id}</Text>
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
  container: { flex: 1, backgroundColor: Colors.canvasParchment },
  scrollView: { flex: 1 },
  content: { padding: Spacing.md, paddingBottom: 40 },
  banner: {
    backgroundColor: Colors.cardBg,
    padding: 14,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderColor: Colors.border,
    marginBottom: 16,
    ...Shadows.subtle,
  },
  bannerTitle: {
    ...Typography.subtopLabel,
    fontSize: 11,
    color: Colors.textMuted,
    marginBottom: 3,
  },
  bannerText: {
    ...Typography.body,
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  overviewCard: {
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderColor: Colors.border,
    padding: 18,
    marginBottom: 16,
    ...Shadows.elevated,
  },
  statusHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  overviewTitle: {
    ...Typography.subtopLabel,
    fontSize: 13,
    color: Colors.textMuted,
  },
  statusBadge: {
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  statusBadgeText: {
    ...Typography.subtopLabel,
    fontSize: 11,
  },
  statGrid: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  statBox: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
    alignItems: 'center',
  },
  statBoxLabel: {
    ...Typography.subtopLabel,
    fontSize: 9,
    color: Colors.textMuted,
  },
  statBoxValue: {
    ...Typography.heroDisplay,
    fontSize: 18,
    color: Colors.ink,
    marginVertical: 2,
  },
  statBoxSub: {
    ...Typography.body,
    fontSize: 10,
    color: Colors.textMuted,
  },
  verifyBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    ...Shadows.subtle,
  },
  verifyBtnText: {
    ...Typography.bodyStrong,
    color: '#ffffff',
    fontSize: 14,
  },
  sectionHeader: {
    ...Typography.subtopLabel,
    fontSize: 13,
    color: Colors.textMuted,
    marginBottom: 10,
    marginTop: 6,
  },
  evidenceAuditCard: {
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderColor: Colors.border,
    padding: 14,
    marginBottom: 10,
    ...Shadows.card,
  },
  evidenceAuditTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  evidenceAuditTitle: {
    ...Typography.headline,
    fontSize: 15,
    color: Colors.ink,
  },
  evidenceAuditId: {
    ...Typography.mono,
    fontSize: 11,
    color: Colors.textMuted,
  },
  miniBadge: { borderWidth: 1, paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radius.full },
  monoHashLabel: {
    ...Typography.subtopLabel,
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 4,
  },
  monoHashValue: {
    ...Typography.mono,
    fontSize: 11,
    color: Colors.ink,
    marginBottom: 4,
  },
  evidenceAuditFooter: { borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 8, marginTop: 4 },
  evidenceAuditMeta: {
    ...Typography.body,
    fontSize: 11,
    color: Colors.textMuted,
  },
  nodeCard: {
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderColor: Colors.border,
    padding: 14,
    marginBottom: 10,
    ...Shadows.card,
  },
  nodeCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  nodePosBadge: {
    backgroundColor: Colors.surface,
    ...Typography.subtopLabel,
    color: Colors.ink,
    fontSize: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  nodeOpBadge: {
    backgroundColor: Colors.primarySubtle,
    ...Typography.subtopLabel,
    color: Colors.primary,
    fontSize: 11,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  nodeTime: {
    ...Typography.body,
    fontSize: 11,
    color: Colors.textMuted,
    marginLeft: 'auto',
  },
  nodeLabel: {
    ...Typography.subtopLabel,
    fontSize: 9,
    color: Colors.textMuted,
    marginTop: 4,
  },
  nodeMono: {
    ...Typography.mono,
    fontSize: 11,
    color: Colors.ink,
    marginBottom: 2,
  },
  nodeEvidenceRef: {
    ...Typography.body,
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 4,
  },
  emptyCategoryCard: {
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    alignItems: 'center',
  },
  emptyCategoryText: {
    ...Typography.body,
    fontSize: 12,
    color: Colors.textMuted,
  },
});

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, Shadows, Typography } from '../theme';
import { useCaseStore } from '../store/caseStore';
import { useEvidenceStore } from '../store/evidenceStore';
import { databaseService } from '../services/databaseService';
import { verificationService } from '../services/verificationService';
import { AppHeader } from '../components/AppHeader';
import { CaseCreateModal } from '../components/CaseCreateModal';
import { CaseSelectModal } from '../components/CaseSelectModal';

interface CaseStats {
  [caseId: string]: {
    evidenceCount: number;
    integrityValid: boolean | null;
  };
}

export function WorkspaceScreen() {
  const router = useRouter();
  const { cases, activeCase, fetchCases, selectCase } = useCaseStore();
  const { fetchEvidence } = useEvidenceStore();

  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [selectModalVisible, setSelectModalVisible] = useState(false);
  const [casesStats, setCasesStats] = useState<CaseStats>({});

  const loadAllCasesStats = useCallback(async () => {
    try {
      const stats: CaseStats = {};
      for (const c of cases) {
        const evidence = await databaseService.getEvidenceForCase(c.id);
        let valid = evidence.length > 0;
        for (const ev of evidence) {
          const v = await verificationService.verifyChain(ev.id);
          if (!v.isValid) {
            valid = false;
            break;
          }
        }
        stats[c.id] = {
          evidenceCount: evidence.length,
          integrityValid: evidence.length > 0 ? valid : null,
        };
      }
      setCasesStats(stats);
    } catch (err) {
      console.error('[WorkspaceScreen] Error loading stats:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [cases]);

  useEffect(() => {
    fetchCases();
  }, [fetchCases]);

  useEffect(() => {
    if (cases.length > 0) {
      loadAllCasesStats();
    } else {
      setLoading(false);
    }
  }, [cases, loadAllCasesStats]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchCases();
    if (activeCase?.id) {
      await fetchEvidence(activeCase.id);
    }
    await loadAllCasesStats();
  }, [activeCase?.id, fetchCases, fetchEvidence, loadAllCasesStats]);

  const handleSelectCase = async (id: string) => {
    await selectCase(id);
    await fetchEvidence(id);
  };

  if (loading && cases.length === 0) {
    return (
      <View style={styles.container}>
        <AppHeader title="Forensic Cases" subtitle="Air-Gapped Mobile Suite" />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading forensic cases…</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AppHeader
        title="Forensic Cases"
        subtitle="Air-Gapped Cryptographic Registry"
        rightAction={
          <TouchableOpacity
            style={styles.headerAddBtn}
            onPress={() => setCreateModalVisible(true)}
            accessibilityLabel="Create New Case"
          >
            <Ionicons name="add" size={24} color="#ffffff" />
          </TouchableOpacity>
        }
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />
        }
      >
        {/* Active Case Hero Banner */}
        {activeCase && (
          <View style={styles.heroCard}>
            <View style={styles.heroTopRow}>
              <View style={styles.heroBadge}>
                <Ionicons name="radio-button-on" size={13} color={Colors.primary} />
                <Text style={styles.heroBadgeText}>ACTIVE CASE</Text>
              </View>
              <TouchableOpacity
                style={styles.switchButton}
                onPress={() => setSelectModalVisible(true)}
                activeOpacity={0.7}
              >
                <Ionicons name="swap-horizontal" size={15} color={Colors.primary} />
                <Text style={styles.switchButtonText}>Switch</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.heroCaseNumber}>{activeCase.caseNumber || activeCase.id}</Text>
            <Text style={styles.heroTitle}>{activeCase.title || 'Untitled Investigation'}</Text>
            {activeCase.description ? (
              <Text style={styles.heroDescription} numberOfLines={2}>
                {activeCase.description}
              </Text>
            ) : null}

            <View style={styles.heroDivider} />

            <View style={styles.heroStatsRow}>
              <View style={[styles.heroStatCol, { flex: 1.2 }]}>
                <Text style={styles.heroStatLabel}>INVESTIGATOR</Text>
                <Text style={styles.heroStatValue} numberOfLines={2}>
                  {activeCase.investigatorName || 'Lead Examiner'}
                </Text>
              </View>

              <View style={styles.heroStatCol}>
                <Text style={styles.heroStatLabel}>EVIDENCE</Text>
                <Text style={styles.heroStatValue}>
                  {casesStats[activeCase.id]?.evidenceCount ?? 0} items
                </Text>
              </View>

              <View style={styles.heroStatCol}>
                <Text style={styles.heroStatLabel}>INTEGRITY</Text>
                <View style={styles.integrityBadge}>
                  <Ionicons
                    name={
                      casesStats[activeCase.id]?.integrityValid === true
                        ? 'shield-checkmark'
                        : casesStats[activeCase.id]?.integrityValid === false
                        ? 'alert-circle'
                        : 'time-outline'
                    }
                    size={15}
                    color={
                      casesStats[activeCase.id]?.integrityValid === true
                        ? Colors.emerald
                        : casesStats[activeCase.id]?.integrityValid === false
                        ? Colors.crimson
                        : Colors.textMuted
                    }
                  />
                  <Text
                    style={[
                      styles.integrityText,
                      {
                        color:
                          casesStats[activeCase.id]?.integrityValid === true
                            ? Colors.emerald
                            : casesStats[activeCase.id]?.integrityValid === false
                            ? Colors.crimson
                            : Colors.textMuted,
                      },
                    ]}
                  >
                    {casesStats[activeCase.id]?.integrityValid === true
                      ? 'VERIFIED'
                      : casesStats[activeCase.id]?.integrityValid === false
                      ? 'COMPROMISED'
                      : 'NO DATA'}
                  </Text>
                </View>
              </View>
            </View>

            <TouchableOpacity
              style={styles.viewDetailsBtn}
              onPress={() => router.push(`/case/${activeCase.id}`)}
              activeOpacity={0.8}
            >
              <Text style={styles.viewDetailsBtnText}>Open Case Details</Text>
              <Ionicons name="arrow-forward" size={16} color="#ffffff" />
            </TouchableOpacity>
          </View>
        )}

        {/* All Cases Header */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>ALL INVESTIGATIONS</Text>
          <Text style={styles.sectionCount}>{cases.length} Total</Text>
        </View>

        {/* Cases List */}
        {cases.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="folder-open-outline" size={40} color={Colors.textMuted} />
            <Text style={styles.emptyTitle}>No Forensic Cases Found</Text>
            <Text style={styles.emptySubtitle}>
              Initialize an air-gapped cryptographic case to begin evidence logging.
            </Text>
            <TouchableOpacity
              style={styles.createCaseBtn}
              onPress={() => setCreateModalVisible(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="add" size={18} color="#ffffff" />
              <Text style={styles.createCaseBtnText}>Create Forensic Case</Text>
            </TouchableOpacity>
          </View>
        ) : (
          cases.map((c) => {
            const isActive = c.id === activeCase?.id;
            const stats = casesStats[c.id];
            const evidenceCount = stats?.evidenceCount ?? 0;
            const isVerified = stats?.integrityValid === true;
            const isTampered = stats?.integrityValid === false;

            return (
              <TouchableOpacity
                key={c.id}
                style={[styles.caseCard, isActive && styles.caseCardActive]}
                onPress={() => handleSelectCase(c.id)}
                activeOpacity={0.8}
              >
                <View style={styles.caseCardTop}>
                  <View style={styles.caseInfo}>
                    <View style={styles.caseNumberBadge}>
                      <Text style={styles.caseNumberText}>{c.caseNumber || c.id}</Text>
                    </View>
                    <Text style={styles.caseNameText} numberOfLines={1}>
                      {c.title || 'Untitled Case'}
                    </Text>
                    <Text style={styles.caseInvestigatorText}>
                      Investigator: {c.investigatorName || 'Unassigned'}
                    </Text>
                  </View>

                  {isActive ? (
                    <View style={styles.activeTag}>
                      <Text style={styles.activeTagText}>CURRENT</Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.selectTag}
                      onPress={() => handleSelectCase(c.id)}
                    >
                      <Text style={styles.selectTagText}>Select</Text>
                    </TouchableOpacity>
                  )}
                </View>

                <View style={styles.caseCardDivider} />

                <View style={styles.caseCardFooter}>
                  <View style={styles.footerItem}>
                    <Ionicons name="document-text-outline" size={16} color={Colors.textMuted} />
                    <Text style={styles.footerText}>{evidenceCount} Evidences</Text>
                  </View>

                  <View style={styles.footerItem}>
                    <Ionicons
                      name={
                        isVerified
                          ? 'shield-checkmark'
                          : isTampered
                          ? 'alert-circle'
                          : 'shield-outline'
                      }
                      size={16}
                      color={
                        isVerified
                          ? Colors.emerald
                          : isTampered
                          ? Colors.crimson
                          : Colors.textMuted
                      }
                    />
                    <Text
                      style={[
                        styles.footerText,
                        {
                          color: isVerified
                            ? Colors.emerald
                            : isTampered
                            ? Colors.crimson
                            : Colors.textMuted,
                          fontWeight: 'bold',
                        },
                      ]}
                    >
                      {isVerified ? 'SHA-256 Valid' : isTampered ? 'Tampered' : 'Unchecked'}
                    </Text>
                  </View>

                  <TouchableOpacity
                    onPress={() => router.push(`/case/${c.id}`)}
                    style={styles.cardArrowBtn}
                  >
                    <Ionicons name="chevron-forward" size={18} color={Colors.primary} />
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* Case Creation Modal */}
      <CaseCreateModal
        visible={createModalVisible}
        onClose={() => setCreateModalVisible(false)}
        onCaseCreated={async (id) => {
          await selectCase(id);
          await fetchCases();
        }}
      />

      {/* Case Switcher Modal */}
      <CaseSelectModal
        visible={selectModalVisible}
        cases={cases}
        activeCaseId={activeCase?.id}
        onClose={() => setSelectModalVisible(false)}
        onSelectCase={async (id) => {
          await selectCase(id);
          await fetchEvidence(id);
        }}
        onCreateNewPress={() => {
          setSelectModalVisible(false);
          setCreateModalVisible(true);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.canvasParchment,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  loadingText: {
    ...Typography.body,
    fontSize: 14,
    color: Colors.textMuted,
  },
  headerAddBtn: {
    width: 38,
    height: 38,
    borderRadius: Radius.full,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.subtle,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: Spacing.md,
    paddingBottom: 40,
  },
  heroCard: {
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderColor: 'rgba(0, 102, 204, 0.35)',
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    ...Shadows.elevated,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primarySubtle,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  heroBadgeText: {
    ...Typography.subtopLabel,
    fontSize: 10,
    color: Colors.primary,
  },
  switchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  switchButtonText: {
    ...Typography.body,
    fontSize: 12,
    color: Colors.primary,
  },
  heroCaseNumber: {
    ...Typography.mono,
    fontSize: 12,
    color: Colors.primary,
    marginBottom: 4,
  },
  heroTitle: {
    ...Typography.heroDisplay,
    fontSize: 27,
    color: Colors.ink,
    letterSpacing: 0.2,
  },
  heroDescription: {
    ...Typography.body,
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 6,
    lineHeight: 20,
  },
  heroDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: Spacing.md,
  },
  heroStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
    gap: 8,
  },
  heroStatCol: {
    flex: 1,
  },
  heroStatLabel: {
    ...Typography.subtopLabel,
    fontSize: 10,
    color: Colors.textMuted,
    marginBottom: 3,
  },
  heroStatValue: {
    ...Typography.bodyStrong,
    fontSize: 13,
    lineHeight: 18,
    color: Colors.ink,
  },
  integrityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  integrityText: {
    ...Typography.bodyStrong,
    fontSize: 12,
  },
  viewDetailsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: 13,
    ...Shadows.subtle,
  },
  viewDetailsBtnText: {
    ...Typography.bodyStrong,
    fontSize: 14,
    color: '#ffffff',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
    marginTop: Spacing.xs,
  },
  sectionTitle: {
    ...Typography.subtopLabel,
    fontSize: 13,
    color: Colors.textMuted,
  },
  sectionCount: {
    ...Typography.body,
    fontSize: 12,
    color: Colors.textMuted,
  },
  caseCard: {
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderColor: Colors.border,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    ...Shadows.card,
  },
  caseCardActive: {
    borderColor: Colors.primary,
    backgroundColor: '#ffffff',
  },
  caseCardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  caseInfo: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  caseNumberBadge: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.sm,
    marginBottom: 5,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  caseNumberText: {
    ...Typography.mono,
    fontSize: 10,
    color: Colors.textMuted,
  },
  caseNameText: {
    ...Typography.displayMd,
    fontSize: 18,
    color: Colors.ink,
    letterSpacing: 0.2,
  },
  caseInvestigatorText: {
    ...Typography.body,
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 3,
  },
  activeTag: {
    backgroundColor: Colors.primarySubtle,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  activeTagText: {
    ...Typography.subtopLabel,
    fontSize: 9,
    color: Colors.primary,
  },
  selectTag: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  selectTagText: {
    ...Typography.bodyStrong,
    fontSize: 12,
    color: Colors.primary,
  },
  caseCardDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: Spacing.sm,
  },
  caseCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  footerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  footerText: {
    ...Typography.body,
    fontSize: 12,
    color: Colors.textMuted,
  },
  cardArrowBtn: {
    padding: 4,
  },
  emptyCard: {
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.md,
    ...Shadows.subtle,
  },
  emptyTitle: {
    ...Typography.headline,
    fontSize: 18,
    color: Colors.ink,
    marginTop: Spacing.md,
  },
  emptySubtitle: {
    ...Typography.body,
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: Spacing.lg,
    lineHeight: 18,
  },
  createCaseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 12,
    borderRadius: Radius.md,
  },
  createCaseBtnText: {
    ...Typography.bodyStrong,
    fontSize: 14,
    color: '#ffffff',
  },
});
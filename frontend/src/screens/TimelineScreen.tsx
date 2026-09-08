import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useCaseStore } from '../store/caseStore';
import { databaseService } from '../services/databaseService';
import {
  temporalReconstructionService,
  ForensicTimelineEvent,
  ReconstructedTimeline,
  TrustIndicator,
  ForensicEventType,
} from '../services/temporalReconstructionService';
import { AppHeader } from '../components/AppHeader';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { EmptyState } from '../components/EmptyState';
import { palette } from '../theme';
import { formatDate } from '../utils/crypto';

const TRUST_COLORS: Record<TrustIndicator, { bg: string; text: string; border: string }> = {
  VERIFIED: { bg: palette.successBg, text: palette.success, border: palette.success },
  INFERRED: { bg: palette.brandYellowBg, text: palette.brandYellow, border: palette.brandYellow },
  UNCERTAIN: { bg: palette.warningBg, text: palette.warning, border: palette.warning },
  REJECTED: { bg: palette.errorBg, text: palette.error, border: palette.error },
};

const EVENT_TYPE_COLORS: Record<ForensicEventType, string> = {
  THREAT: palette.error,
  PAYMENT_DEMAND: palette.brandYellow,
  BLACKMAIL: palette.error,
  COERCION: palette.deepBlack,
  COMMUNICATION: palette.deepBlack,
  MEDIA_CAPTURE: palette.brandYellow,
  MEDIA_UPLOAD: palette.success,
  OTHER: palette.textSecondary,
};

export function TimelineScreen() {
  const router = useRouter();
  const activeCase = useCaseStore((state) => state.activeCase);

  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reconstructed, setReconstructed] = useState<ReconstructedTimeline | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTrust, setSelectedTrust] = useState<TrustIndicator[]>(['VERIFIED', 'INFERRED', 'UNCERTAIN', 'REJECTED']);
  const [selectedType, setSelectedType] = useState<ForensicEventType | 'ALL'>('ALL');

  const loadTimeline = useCallback(async () => {
    if (!activeCase?.id) {
      setReconstructed(null);
      setIsLoading(false);
      return;
    }
    setError(null);
    try {
      const [events, evidence] = await Promise.all([
        databaseService.getEventRecordsForCase(activeCase.id),
        databaseService.getEvidenceRecordsForCase(activeCase.id),
      ]);

      const result = temporalReconstructionService.reconstructFromDatabaseRecords(
        activeCase.id,
        events,
        evidence
      );
      setReconstructed(result);
    } catch (err: unknown) {
      setError((err as Error)?.message || 'Failed to reconstruct incident timeline from SQLite.');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [activeCase?.id]);

  useEffect(() => {
    setIsLoading(true);
    loadTimeline();
  }, [loadTimeline]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadTimeline();
  }, [loadTimeline]);

  // Filter matching
  const filterEvents = (eventList: ForensicTimelineEvent[]): ForensicTimelineEvent[] => {
    return eventList.filter((ev) => {
      if (!selectedTrust.includes(ev.trustIndicator)) return false;
      if (selectedType !== 'ALL' && ev.eventType !== selectedType) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesDesc = ev.description.toLowerCase().includes(q);
        const matchesType = ev.eventType.toLowerCase().includes(q);
        const matchesEvidence = ev.evidenceId.toLowerCase().includes(q);
        return matchesDesc || matchesType || matchesEvidence;
      }
      return true;
    });
  };

  const filteredChronological = useMemo(() => {
    return reconstructed ? filterEvents(reconstructed.chronologicalEvents) : [];
  }, [reconstructed, selectedTrust, selectedType, searchQuery]);

  const filteredUnknown = useMemo(() => {
    return reconstructed ? filterEvents(reconstructed.unknownTimestampEvents) : [];
  }, [reconstructed, selectedTrust, selectedType, searchQuery]);

  const filteredRejected = useMemo(() => {
    return reconstructed ? filterEvents(reconstructed.rejectedEvents) : [];
  }, [reconstructed, selectedTrust, selectedType, searchQuery]);

  const toggleTrust = (t: TrustIndicator) => {
    setSelectedTrust((prev) =>
      prev.includes(t) ? prev.filter((item) => item !== t) : [...prev, t]
    );
  };

  return (
    <View style={styles.container}>
      <AppHeader
        title="INCIDENT TIMELINE"
        subtitle={`Deterministic Reconstruction · Case ${activeCase?.caseNumber || 'N/A'}`}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[palette.primary]} />
        }
      >
        {/* Forensics Principles Banner */}
        <View style={styles.banner}>
          <Text style={styles.bannerTitle}>DETERMINISTIC TEMPORAL RECONSTRUCTION</Text>
          <Text style={styles.bannerText}>
            Chronology strictly governed by verified timestamps. LLM/Gemma provides semantic candidates only. Missing timestamps are isolated and never fabricated.
          </Text>
        </View>

        {/* Stats Strip */}
        {reconstructed && (
          <View style={styles.statsStrip}>
            <View style={styles.statCol}>
              <Text style={styles.statVal}>{reconstructed.totalEventsCount}</Text>
              <Text style={styles.statLbl}>TOTAL</Text>
            </View>
            <View style={styles.statCol}>
              <Text style={[styles.statVal, { color: palette.success }]}>
                {reconstructed.verifiedCount}
              </Text>
              <Text style={styles.statLbl}>VERIFIED</Text>
            </View>
            <View style={styles.statCol}>
              <Text style={[styles.statVal, { color: palette.primary }]}>
                {reconstructed.inferredCount}
              </Text>
              <Text style={styles.statLbl}>INFERRED</Text>
            </View>
            <View style={styles.statCol}>
              <Text style={[styles.statVal, { color: palette.warning }]}>
                {reconstructed.uncertainCount}
              </Text>
              <Text style={styles.statLbl}>UNCERTAIN</Text>
            </View>
            <View style={styles.statCol}>
              <Text style={[styles.statVal, { color: palette.error }]}>
                {reconstructed.rejectedCount}
              </Text>
              <Text style={styles.statLbl}>REJECTED</Text>
            </View>
          </View>
        )}

        {/* Search & Filter Bar */}
        <View style={styles.filterSection}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search events, descriptions, evidence IDs…"
            placeholderTextColor={palette.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />

          <View style={styles.trustFilterRow}>
            {(['VERIFIED', 'INFERRED', 'UNCERTAIN', 'REJECTED'] as TrustIndicator[]).map((t) => {
              const active = selectedTrust.includes(t);
              const colorInfo = TRUST_COLORS[t];
              return (
                <TouchableOpacity
                  key={t}
                  style={[
                    styles.trustChip,
                    active && { backgroundColor: colorInfo.bg, borderColor: colorInfo.border },
                  ]}
                  onPress={() => toggleTrust(t)}
                >
                  <Text style={[styles.trustChipText, { color: active ? colorInfo.text : palette.textSecondary }]}>
                    {t}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {isLoading ? (
          <LoadingSpinner label="Reconstructing incident chronology…" />
        ) : error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>⚠️ {error}</Text>
          </View>
        ) : !reconstructed || reconstructed.totalEventsCount === 0 ? (
          <EmptyState
            title="No Chronological Events"
            message="No forensic events or evidence recorded yet. Ingest evidence and run analysis to populate the incident timeline."
          />
        ) : (
          <>
            {/* ── 1. CHRONOLOGICAL TIMELINE (VERIFIED TIMESTAMPS) ── */}
            <View style={styles.timelineSectionHeader}>
              <Text style={styles.timelineSectionTitle}>CHRONOLOGICAL TIMELINE</Text>
              <Text style={styles.timelineSectionCount}>
                {filteredChronological.length} verified/inferred sequence events
              </Text>
            </View>

            {filteredChronological.length === 0 ? (
              <View style={styles.emptyFilterBox}>
                <Text style={styles.emptyFilterText}>No chronological events matching filter.</Text>
              </View>
            ) : (
              <View style={styles.timelineSpineContainer}>
                {filteredChronological.map((ev, idx) => {
                  const trustStyle = TRUST_COLORS[ev.trustIndicator];
                  const typeColor = EVENT_TYPE_COLORS[ev.eventType] || palette.primary;
                  const isLast = idx === filteredChronological.length - 1;

                  return (
                    <View key={ev.id} style={styles.timelineRow}>
                      {/* Left: Time column */}
                      <View style={styles.timeCol}>
                        <Text style={styles.timeText}>
                          {ev.timestamp ? formatDate(ev.timestamp).split(' ')[1] || formatDate(ev.timestamp) : 'N/A'}
                        </Text>
                        <Text style={styles.dateText}>
                          {ev.timestamp ? formatDate(ev.timestamp).split(' ')[0] : ''}
                        </Text>
                        <Text style={styles.provenanceTag}>
                          [{ev.timestampProvenance}]
                        </Text>
                      </View>

                      {/* Center: Spine & Node */}
                      <View style={styles.spineCol}>
                        <View style={[styles.spineNode, { borderColor: typeColor }]} />
                        {!isLast && <View style={styles.spineLine} />}
                      </View>

                      {/* Right: Event Card */}
                      <TouchableOpacity
                        style={[styles.eventCard, { borderLeftColor: typeColor }]}
                        activeOpacity={0.8}
                        onPress={() => {
                          if (ev.evidenceId && !ev.evidenceId.startsWith('UNGROUNDED')) {
                            router.push(`/evidence/${ev.evidenceId}`);
                          }
                        }}
                      >
                        <View style={styles.eventCardHeader}>
                          <View style={[styles.eventTypeBadge, { backgroundColor: palette.surfaceVariant }]}>
                            <Text style={[styles.eventTypeText, { color: typeColor }]}>
                              {ev.eventType}
                            </Text>
                          </View>

                          <View
                            style={[
                              styles.trustBadge,
                              { backgroundColor: trustStyle.bg, borderColor: trustStyle.border },
                            ]}
                          >
                            <Text style={[styles.trustBadgeText, { color: trustStyle.text }]}>
                              {ev.trustIndicator}
                            </Text>
                          </View>
                        </View>

                        <Text style={styles.eventDesc}>{ev.description}</Text>

                        <View style={styles.eventCardFooter}>
                          <Text style={styles.evidenceRef}>
                            Evidence: <Text style={styles.evidenceRefLink}>{ev.evidenceId || 'N/A'}</Text>
                          </Text>
                          <Text style={styles.tapToView}>Tap to view →</Text>
                        </View>
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            )}

            {/* ── 2. TIMESTAMP UNKNOWN (ISOLATED) ── */}
            {filteredUnknown.length > 0 && (
              <View style={styles.isolatedSection}>
                <View style={styles.isolatedHeader}>
                  <Text style={styles.isolatedTitle}>⚠️ TIMESTAMP UNKNOWN / UNRESOLVED</Text>
                  <Text style={styles.isolatedSub}>
                    Events with missing or conflicting timestamps. Chronological placement is not fabricated.
                  </Text>
                </View>

                {filteredUnknown.map((ev) => {
                  const trustStyle = TRUST_COLORS[ev.trustIndicator];
                  const typeColor = EVENT_TYPE_COLORS[ev.eventType] || palette.warning;

                  return (
                    <TouchableOpacity
                      key={ev.id}
                      style={[styles.isolatedCard, { borderLeftColor: typeColor }]}
                      onPress={() => {
                        if (ev.evidenceId && !ev.evidenceId.startsWith('UNGROUNDED')) {
                          router.push(`/evidence/${ev.evidenceId}`);
                        }
                      }}
                    >
                      <View style={styles.eventCardHeader}>
                        <Text style={[styles.eventTypeText, { color: typeColor }]}>{ev.eventType}</Text>
                        <View
                          style={[
                            styles.trustBadge,
                            { backgroundColor: trustStyle.bg, borderColor: trustStyle.border },
                          ]}
                        >
                          <Text style={[styles.trustBadgeText, { color: trustStyle.text }]}>
                            {ev.trustIndicator}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.eventDesc}>{ev.description}</Text>
                      <Text style={styles.evidenceRef}>
                        Evidence: <Text style={styles.evidenceRefLink}>{ev.evidenceId}</Text> · Chronology: Unverified
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* ── 3. REJECTED CLAIMS AUDIT ── */}
            {filteredRejected.length > 0 && (
              <View style={[styles.isolatedSection, { borderColor: palette.error }]}>
                <View style={styles.isolatedHeader}>
                  <Text style={[styles.isolatedTitle, { color: palette.error }]}>
                    🚫 REJECTED CLAIMS (AUDIT TRAIL)
                  </Text>
                  <Text style={styles.isolatedSub}>
                    Generated candidate claims rejected by deterministic evidence-grounding validation.
                  </Text>
                </View>

                {filteredRejected.map((ev) => (
                  <View key={ev.id} style={[styles.isolatedCard, { borderLeftColor: palette.error }]}>
                    <View style={styles.eventCardHeader}>
                      <Text style={[styles.eventTypeText, { color: palette.error }]}>{ev.eventType}</Text>
                      <View
                        style={[
                          styles.trustBadge,
                          { backgroundColor: 'rgba(239, 68, 68, 0.15)', borderColor: palette.error },
                        ]}
                      >
                        <Text style={[styles.trustBadgeText, { color: palette.error }]}>REJECTED</Text>
                      </View>
                    </View>
                    <Text style={styles.eventDesc}>{ev.description}</Text>
                    <Text style={[styles.evidenceRef, { color: palette.error }]}>
                      Reason: {ev.rejectionReason || 'Ungrounded in evidence context'}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
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
  bannerTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: palette.deepBlack,
    marginBottom: 2,
    letterSpacing: 0.6,
  },
  bannerText: {
    fontSize: 11,
    color: palette.textSecondary,
    lineHeight: 16,
    fontWeight: '500',
  },
  statsStrip: {
    flexDirection: 'row',
    backgroundColor: palette.surface,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: palette.borderDark,
    paddingVertical: 10,
    marginBottom: 14,
    elevation: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
  },
  statCol: {
    flex: 1,
    alignItems: 'center',
  },
  statVal: {
    fontSize: 16,
    fontWeight: '900',
    color: palette.deepBlack,
  },
  statLbl: {
    fontSize: 9,
    fontWeight: '800',
    color: palette.textSecondary,
    marginTop: 2,
    letterSpacing: 0.5,
  },
  filterSection: {
    marginBottom: 14,
    gap: 8,
  },
  searchInput: {
    backgroundColor: palette.surface,
    borderWidth: 1.5,
    borderColor: palette.borderDark,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: palette.deepBlack,
    fontSize: 13,
    fontWeight: '600',
  },
  trustFilterRow: {
    flexDirection: 'row',
    gap: 6,
  },
  trustChip: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: palette.borderDark,
    backgroundColor: palette.surface,
    alignItems: 'center',
  },
  trustChipText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  timelineSectionHeader: {
    marginBottom: 12,
    marginTop: 4,
  },
  timelineSectionTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: palette.deepBlack,
    letterSpacing: 0.8,
  },
  timelineSectionCount: {
    fontSize: 11,
    fontWeight: '600',
    color: palette.textSecondary,
  },
  timelineSpineContainer: {
    paddingLeft: 4,
    marginBottom: 20,
  },
  timelineRow: {
    flexDirection: 'row',
    marginBottom: 14,
  },
  timeCol: {
    width: 64,
    paddingRight: 6,
    alignItems: 'flex-end',
    paddingTop: 4,
  },
  timeText: {
    fontFamily: 'monospace',
    fontSize: 11,
    fontWeight: '800',
    color: palette.deepBlack,
  },
  dateText: {
    fontSize: 9,
    fontWeight: '600',
    color: palette.textSecondary,
  },
  provenanceTag: {
    fontSize: 8,
    fontWeight: '800',
    color: palette.deepBlack,
    marginTop: 2,
  },
  spineCol: {
    width: 20,
    alignItems: 'center',
    position: 'relative',
  },
  spineNode: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: palette.background,
    borderWidth: 3,
    marginTop: 5,
    zIndex: 2,
  },
  spineLine: {
    position: 'absolute',
    top: 15,
    bottom: -20,
    width: 2,
    backgroundColor: palette.borderDark,
    zIndex: 1,
  },
  eventCard: {
    flex: 1,
    backgroundColor: palette.surface,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: palette.borderDark,
    borderLeftWidth: 4,
    padding: 12,
    marginLeft: 6,
    elevation: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
  },
  eventCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  eventTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  eventTypeText: {
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  trustBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  trustBadgeText: {
    fontSize: 9,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  eventDesc: {
    fontSize: 13,
    color: palette.text,
    lineHeight: 18,
    marginBottom: 8,
  },
  eventCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: palette.border,
    paddingTop: 6,
  },
  evidenceRef: {
    fontSize: 11,
    color: palette.textSecondary,
  },
  evidenceRefLink: {
    fontFamily: 'monospace',
    color: palette.brandYellow,
    fontWeight: 'bold',
  },
  tapToView: {
    fontSize: 10,
    color: palette.deepBlack,
    fontWeight: '600',
  },
  isolatedSection: {
    backgroundColor: palette.surfaceVariant,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: palette.warning,
    padding: 14,
    marginTop: 14,
    marginBottom: 14,
  },
  isolatedHeader: {
    marginBottom: 10,
  },
  isolatedTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: palette.warning,
    letterSpacing: 0.6,
  },
  isolatedSub: {
    fontSize: 11,
    color: palette.textSecondary,
    marginTop: 2,
    lineHeight: 15,
  },
  isolatedCard: {
    backgroundColor: palette.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.border,
    borderLeftWidth: 4,
    padding: 10,
    marginBottom: 8,
  },
  emptyFilterBox: {
    padding: 16,
    alignItems: 'center',
    backgroundColor: palette.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.border,
    marginBottom: 14,
  },
  emptyFilterText: {
    fontSize: 12,
    color: palette.textSecondary,
  },
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: palette.error,
    borderRadius: 8,
    padding: 14,
    marginVertical: 10,
  },
  errorText: {
    color: palette.error,
    fontSize: 13,
  },
});
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
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
import { Colors, Spacing, Typography, Radius, Shadows } from '../theme';
import { formatEventDate, formatEventTime } from '../utils/crypto';

const TRUST_CONFIG: Record<TrustIndicator, { bg: string; text: string; border: string }> = {
  VERIFIED: { bg: 'rgba(16, 185, 129, 0.12)', text: Colors.emerald, border: Colors.emerald },
  INFERRED: { bg: Colors.primarySubtle, text: Colors.primary, border: Colors.primary },
  UNCERTAIN: { bg: 'rgba(245, 158, 11, 0.12)', text: Colors.amber, border: Colors.amber },
  REJECTED: { bg: 'rgba(239, 68, 68, 0.12)', text: Colors.crimson, border: Colors.crimson },
};

const EVENT_TYPE_COLORS: Record<ForensicEventType, string> = {
  THREAT: Colors.crimson,
  PAYMENT_DEMAND: Colors.amber,
  BLACKMAIL: Colors.crimson,
  COERCION: Colors.crimson,
  COMMUNICATION: Colors.primary,
  MEDIA_CAPTURE: Colors.emerald,
  MEDIA_UPLOAD: Colors.primary,
  OTHER: Colors.textMuted,
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
        title="Incident Timeline"
        subtitle={`Deterministic Chain · Case ${activeCase?.caseNumber || 'Active'}`}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />
        }
      >
        {/* Forensics Principles Banner */}
        <View style={styles.banner}>
          <Text style={styles.bannerTitle}>DETERMINISTIC TEMPORAL RECONSTRUCTION</Text>
          <Text style={styles.bannerText}>
            Chronology strictly ordered by cryptographically verified timestamps. Unverified items remain isolated.
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
              <Text style={[styles.statVal, { color: Colors.emerald }]}>
                {reconstructed.verifiedCount}
              </Text>
              <Text style={styles.statLbl}>VERIFIED</Text>
            </View>
            <View style={styles.statCol}>
              <Text style={[styles.statVal, { color: Colors.primary }]}>
                {reconstructed.inferredCount}
              </Text>
              <Text style={styles.statLbl}>INFERRED</Text>
            </View>
            <View style={styles.statCol}>
              <Text style={[styles.statVal, { color: Colors.amber }]}>
                {reconstructed.uncertainCount}
              </Text>
              <Text style={styles.statLbl}>UNCERTAIN</Text>
            </View>
            <View style={styles.statCol}>
              <Text style={[styles.statVal, { color: Colors.crimson }]}>
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
            placeholder="Search timeline events, IDs, entities..."
            placeholderTextColor={Colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />

          <View style={styles.segmentedControl}>
            {(['VERIFIED', 'INFERRED', 'UNCERTAIN', 'REJECTED'] as TrustIndicator[]).map((t) => {
              const active = selectedTrust.includes(t);
              const colorInfo = TRUST_CONFIG[t];
              return (
                <TouchableOpacity
                  key={t}
                  style={[
                    styles.segmentedTab,
                    active && styles.segmentedTabActive,
                  ]}
                  onPress={() => toggleTrust(t)}
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      styles.trustDot,
                      { backgroundColor: active ? colorInfo.text : Colors.border },
                    ]}
                  />
                  <Text
                    style={[
                      styles.segmentedTabText,
                      active && { color: colorInfo.text, fontWeight: '800' },
                    ]}
                  >
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
                  const trustStyle = TRUST_CONFIG[ev.trustIndicator] || TRUST_CONFIG.UNCERTAIN;
                  const typeColor = EVENT_TYPE_COLORS[ev.eventType] || Colors.primary;
                  const isLast = idx === filteredChronological.length - 1;

                  const timeDisplay = formatEventTime(ev.timestamp);
                  const dateDisplay = formatEventDate(ev.timestamp);

                  return (
                    <View key={ev.id} style={styles.timelineRow}>
                      {/* Left: Time Box */}
                      <View style={styles.timeCol}>
                        <View style={styles.timeBox}>
                          <Text style={styles.timeText}>{timeDisplay}</Text>
                          <Text style={styles.dateText}>{dateDisplay}</Text>
                          <View style={styles.provenancePill}>
                            <Text style={styles.provenanceTag}>{ev.timestampProvenance}</Text>
                          </View>
                        </View>
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
                          <View style={styles.eventTypeBadge}>
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
                          <Text style={styles.evidenceRef} numberOfLines={1} ellipsizeMode="middle">
                            Ref:{' '}
                            <Text style={styles.evidenceRefLink}>
                              {ev.evidenceId
                                ? ev.evidenceId.length > 20
                                  ? `${ev.evidenceId.slice(0, 8)}...${ev.evidenceId.slice(-6)}`
                                  : ev.evidenceId
                                : 'N/A'}
                            </Text>
                          </Text>
                          <View style={styles.inspectBtnWrap}>
                            <Text style={styles.tapToView}>Inspect →</Text>
                          </View>
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
                  <Text style={styles.isolatedTitle}>⚠️ UNRESOLVED TIMESTAMPS ({filteredUnknown.length})</Text>
                  <Text style={styles.isolatedSub}>
                    Events with missing or conflicting metadata. Chronology is not guessed.
                  </Text>
                </View>

                {filteredUnknown.map((ev) => {
                  const trustStyle = TRUST_CONFIG[ev.trustIndicator] || TRUST_CONFIG.UNCERTAIN;
                  const typeColor = EVENT_TYPE_COLORS[ev.eventType] || Colors.amber;

                  return (
                    <TouchableOpacity
                      key={ev.id}
                      style={[styles.isolatedCard, { borderLeftColor: typeColor }]}
                      activeOpacity={0.8}
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
                      <Text style={styles.evidenceRef} numberOfLines={1} ellipsizeMode="middle">
                        Evidence:{' '}
                        <Text style={styles.evidenceRefLink}>
                          {ev.evidenceId
                            ? ev.evidenceId.length > 20
                              ? `${ev.evidenceId.slice(0, 8)}...${ev.evidenceId.slice(-6)}`
                              : ev.evidenceId
                            : 'N/A'}
                        </Text>
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* ── 3. REJECTED CLAIMS AUDIT ── */}
            {filteredRejected.length > 0 && (
              <View style={[styles.isolatedSection, { borderColor: Colors.crimson }]}>
                <View style={styles.isolatedHeader}>
                  <Text style={[styles.isolatedTitle, { color: Colors.crimson }]}>
                    🚫 REJECTED CLAIMS ({filteredRejected.length})
                  </Text>
                  <Text style={styles.isolatedSub}>
                    Claims rejected during strict evidence-grounding audit.
                  </Text>
                </View>

                {filteredRejected.map((ev) => (
                  <View key={ev.id} style={[styles.isolatedCard, { borderLeftColor: Colors.crimson }]}>
                    <View style={styles.eventCardHeader}>
                      <Text style={[styles.eventTypeText, { color: Colors.crimson }]}>{ev.eventType}</Text>
                      <View
                        style={[
                          styles.trustBadge,
                          { backgroundColor: 'rgba(239, 68, 68, 0.12)', borderColor: Colors.crimson },
                        ]}
                      >
                        <Text style={[styles.trustBadgeText, { color: Colors.crimson }]}>REJECTED</Text>
                      </View>
                    </View>
                    <Text style={styles.eventDesc}>{ev.description}</Text>
                    <Text style={[styles.evidenceRef, { color: Colors.crimson }]} numberOfLines={2}>
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
    backgroundColor: Colors.canvas,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: Spacing.md,
    paddingBottom: 40,
  },
  banner: {
    backgroundColor: Colors.cardBg,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.md,
    ...Shadows.subtle,
  },
  bannerTitle: {
    ...Typography.subtopLabel,
    fontSize: 11,
    fontWeight: '800',
    color: Colors.textMuted,
    marginBottom: 4,
  },
  bannerText: {
    ...Typography.body,
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  statsStrip: {
    flexDirection: 'row',
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: Spacing.md,
    marginBottom: Spacing.md,
    ...Shadows.subtle,
  },
  statCol: {
    flex: 1,
    alignItems: 'center',
  },
  statVal: {
    ...Typography.displayMd,
    fontSize: 18,
    fontWeight: '900',
    color: Colors.text,
  },
  statLbl: {
    ...Typography.subtopLabel,
    fontSize: 9,
    fontWeight: '800',
    color: Colors.textMuted,
    marginTop: 2,
  },
  filterSection: {
    marginBottom: Spacing.md,
    gap: 8,
  },
  searchInput: {
    ...Typography.body,
    backgroundColor: Colors.cardBg,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    color: Colors.text,
    fontSize: 13,
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: 3,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 3,
  },
  segmentedTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    paddingHorizontal: 2,
    borderRadius: Radius.sm,
    gap: 4,
  },
  segmentedTabActive: {
    backgroundColor: Colors.cardBg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  trustDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  segmentedTabText: {
    ...Typography.bodyStrong,
    fontSize: 9.5,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 0.2,
  },
  timelineSectionHeader: {
    marginBottom: Spacing.sm,
    marginTop: Spacing.xs,
  },
  timelineSectionTitle: {
    ...Typography.subtopLabel,
    fontSize: 12,
    fontWeight: '800',
    color: Colors.textMuted,
  },
  timelineSectionCount: {
    ...Typography.body,
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMuted,
    marginTop: 2,
  },
  timelineSpineContainer: {
    paddingLeft: 2,
    marginBottom: Spacing.lg,
  },
  timelineRow: {
    flexDirection: 'row',
    marginBottom: 14,
  },
  timeCol: {
    width: 82,
    paddingRight: 4,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  timeBox: {
    width: '100%',
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.md,
    borderWidth: 1.2,
    borderColor: Colors.border,
    paddingVertical: 6,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.subtle,
  },
  timeText: {
    ...Typography.mono,
    fontSize: 11,
    fontWeight: '800',
    color: Colors.ink,
    textAlign: 'center',
  },
  dateText: {
    ...Typography.body,
    fontSize: 9,
    fontWeight: '700',
    color: Colors.textMuted,
    marginTop: 2,
    textAlign: 'center',
  },
  provenancePill: {
    marginTop: 4,
    paddingHorizontal: 4,
    paddingVertical: 1.5,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surface,
    borderWidth: 0.5,
    borderColor: Colors.border,
  },
  provenanceTag: {
    ...Typography.mono,
    fontSize: 7.5,
    fontWeight: '800',
    color: Colors.textMuted,
    textAlign: 'center',
  },
  spineCol: {
    width: 16,
    alignItems: 'center',
    position: 'relative',
  },
  spineNode: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.cardBg,
    borderWidth: 2.5,
    marginTop: 5,
    zIndex: 2,
  },
  spineLine: {
    position: 'absolute',
    top: 15,
    bottom: -20,
    width: 1.5,
    backgroundColor: Colors.border,
    zIndex: 1,
  },
  eventCard: {
    flex: 1,
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    borderLeftWidth: 3.5,
    padding: 12,
    marginLeft: 4,
    overflow: 'hidden',
    ...Shadows.subtle,
  },
  eventCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    gap: 6,
  },
  eventTypeBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surface,
    flexShrink: 1,
  },
  eventTypeText: {
    ...Typography.bodyStrong,
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  trustBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: Radius.full,
    borderWidth: 1,
    flexShrink: 0,
  },
  trustBadgeText: {
    ...Typography.subtopLabel,
    fontSize: 8.5,
    fontWeight: '800',
  },
  eventDesc: {
    ...Typography.body,
    fontSize: 12.5,
    color: Colors.text,
    lineHeight: 18,
    marginBottom: 8,
    flexShrink: 1,
  },
  eventCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 8,
    marginTop: 2,
    gap: 8,
  },
  evidenceRef: {
    ...Typography.body,
    flex: 1,
    fontSize: 10.5,
    color: Colors.textMuted,
  },
  evidenceRefLink: {
    ...Typography.mono,
    color: Colors.primary,
    fontWeight: '700',
    fontSize: 10,
  },
  inspectBtnWrap: {
    flexShrink: 0,
  },
  tapToView: {
    ...Typography.bodyStrong,
    fontSize: 10.5,
    color: Colors.primary,
    fontWeight: '700',
  },
  isolatedSection: {
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    ...Shadows.subtle,
  },
  isolatedHeader: {
    marginBottom: 10,
  },
  isolatedTitle: {
    ...Typography.subtopLabel,
    fontSize: 11,
    fontWeight: '900',
    color: Colors.amber,
  },
  isolatedSub: {
    ...Typography.body,
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
    lineHeight: 16,
  },
  isolatedCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    borderLeftWidth: 3,
    padding: Spacing.sm,
    marginBottom: 8,
  },
  emptyFilterBox: {
    padding: Spacing.lg,
    alignItems: 'center',
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.md,
  },
  emptyFilterText: {
    ...Typography.body,
    fontSize: 13,
    color: Colors.textMuted,
  },
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginVertical: Spacing.sm,
  },
  errorText: {
    ...Typography.bodyStrong,
    color: Colors.crimson,
    fontSize: 13,
  },
});
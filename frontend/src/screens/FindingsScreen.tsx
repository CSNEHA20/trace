import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useCaseStore } from '../store/caseStore';
import { databaseService } from '../services/databaseService';
import { AppHeader } from '../components/AppHeader';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { EmptyState } from '../components/EmptyState';
import { Colors, Spacing, Radius, Typography, Shadows } from '../theme';
import { NarrativeRecord, EventRecord, ActorRecord, EvidenceItem } from '../types';
import { Ionicons } from '@expo/vector-icons';

export function FindingsScreen() {
  const router = useRouter();
  const activeCase = useCaseStore((state) => state.activeCase);

  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [narrative, setNarrative] = useState<NarrativeRecord | null>(null);
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [actors, setActors] = useState<ActorRecord[]>([]);
  const [evidence, setEvidence] = useState<EvidenceItem[]>([]);

  const loadFindings = useCallback(async () => {
    if (!activeCase?.id) {
      setNarrative(null);
      setEvents([]);
      setActors([]);
      setEvidence([]);
      setIsLoading(false);
      return;
    }

    try {
      const [caseNarrative, caseEvents, caseActors, caseEvidence] = await Promise.all([
        databaseService.getLatestNarrativeForCase(activeCase.id),
        databaseService.getEventsForCase(activeCase.id),
        databaseService.getActorsForCase(activeCase.id),
        databaseService.getEvidenceForCase(activeCase.id),
      ]);

      setNarrative(caseNarrative);
      setEvents(caseEvents);
      setActors(caseActors);
      setEvidence(caseEvidence);
    } catch (err) {
      console.error('[FindingsScreen] Error loading findings:', err);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [activeCase?.id]);

  useEffect(() => {
    setIsLoading(true);
    loadFindings();
  }, [loadFindings]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadFindings();
  }, [loadFindings]);

  // Categorize events by event_type
  const threatEvents = events.filter((e) => e.event_type.toLowerCase().includes('threat'));
  const demandEvents = events.filter((e) => e.event_type.toLowerCase().includes('payment') || e.event_type.toLowerCase().includes('demand'));
  const blackmailEvents = events.filter((e) => e.event_type.toLowerCase().includes('blackmail') || e.event_type.toLowerCase().includes('extortion'));
  const coercionEvents = events.filter((e) => e.event_type.toLowerCase().includes('coercion') || e.event_type.toLowerCase().includes('intimidation'));

  const parsedNarrativeSections = narrative ? parseNarrativeText(narrative.content) : null;

  return (
    <View style={styles.container}>
      <AppHeader
        title="FORENSIC FINDINGS"
        subtitle={`Grounded Analysis · Case ${activeCase?.caseNumber || 'N/A'}`}
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
          <Text style={styles.bannerTitle}>EVIDENCE-GROUNDED FORENSIC FINDINGS</Text>
          <Text style={styles.bannerText}>
            Findings are extracted locally by Gemma 2B INT4 and deterministically grounded against verified SQLite evidence.
          </Text>
        </View>

        {isLoading ? (
          <LoadingSpinner label="Loading verified findings…" />
        ) : !narrative && events.length === 0 && actors.length === 0 ? (
          <EmptyState
            title="No Verified Findings"
            message="No forensic analysis has been executed for this case yet. Ingest evidence and run Analyze Case from the workspace."
          />
        ) : (
          <>
            {/* ── INCIDENT SUMMARY ── */}
            {parsedNarrativeSections?.summary && (
              <View style={styles.sectionContainer}>
                <Text style={styles.sectionTitle}>INCIDENT CLASSIFICATION & SUMMARY</Text>
                <View style={styles.card}>
                  <Text style={styles.summaryText}>{parsedNarrativeSections.summary}</Text>
                </View>
              </View>
            )}

            {/* ── THREATS DETECTED ── */}
            <View style={styles.sectionContainer}>
              <View style={styles.sectionHeaderRow}>
                <Text style={[styles.sectionTitle, { color: Colors.crimson }]}>THREATS DETECTED</Text>
                <Text style={styles.countBadge}>{threatEvents.length + (parsedNarrativeSections?.threats.length || 0)}</Text>
              </View>

              {threatEvents.length === 0 && (!parsedNarrativeSections || parsedNarrativeSections.threats.length === 0) ? (
                <View style={styles.emptyCategoryCard}>
                  <Text style={styles.emptyCategoryText}>No explicit threats detected in case evidence.</Text>
                </View>
              ) : (
                <>
                  {threatEvents.map((ev) => (
                    <TouchableOpacity
                      key={ev.id}
                      style={[styles.card, { borderLeftColor: Colors.crimson }]}
                      onPress={() => {
                        if (ev.evidence_ids && ev.evidence_ids.length > 0) {
                          router.push(`/evidence/${ev.evidence_ids[0]}`);
                        }
                      }}
                      activeOpacity={0.8}
                    >
                      <View style={styles.findingCardHeader}>
                        <Text style={styles.findingTypeBadge}>THREAT EVENT</Text>
                        <Text style={styles.certaintyBadge}>
                          {ev.ai_summary?.includes('[INFERRED]') ? 'INFERRED' : 'VERIFIED'}
                        </Text>
                      </View>
                      <Text style={styles.findingDesc}>{ev.ai_summary || ev.event_type}</Text>
                      {ev.evidence_ids?.length > 0 && (
                        <Text style={styles.evidenceLink}>
                          Source Evidence: <Text style={styles.monoLink}>{ev.evidence_ids[0]}</Text> →
                        </Text>
                      )}
                    </TouchableOpacity>
                  ))}

                  {parsedNarrativeSections?.threats.map((t, idx) => (
                    <View key={`nt-${idx}`} style={[styles.card, { borderLeftColor: Colors.crimson }]}>
                      <Text style={styles.findingDesc}>{t}</Text>
                    </View>
                  ))}
                </>
              )}
            </View>

            {/* ── BLACKMAIL & EXTORTION ── */}
            <View style={styles.sectionContainer}>
              <View style={styles.sectionHeaderRow}>
                <Text style={[styles.sectionTitle, { color: Colors.crimson }]}>BLACKMAIL & EXTORTION</Text>
                <Text style={styles.countBadge}>{blackmailEvents.length + (parsedNarrativeSections?.blackmail.length || 0)}</Text>
              </View>

              {blackmailEvents.length === 0 && (!parsedNarrativeSections || parsedNarrativeSections.blackmail.length === 0) ? (
                <View style={styles.emptyCategoryCard}>
                  <Text style={styles.emptyCategoryText}>No blackmail or extortion indicators logged.</Text>
                </View>
              ) : (
                <>
                  {blackmailEvents.map((ev) => (
                    <TouchableOpacity
                      key={ev.id}
                      style={[styles.card, { borderLeftColor: Colors.crimson }]}
                      onPress={() => {
                        if (ev.evidence_ids && ev.evidence_ids.length > 0) {
                          router.push(`/evidence/${ev.evidence_ids[0]}`);
                        }
                      }}
                      activeOpacity={0.8}
                    >
                      <View style={styles.findingCardHeader}>
                        <Text style={styles.findingTypeBadge}>EXTORTION EVENT</Text>
                        <Text style={styles.certaintyBadge}>
                          {ev.ai_summary?.includes('[INFERRED]') ? 'INFERRED' : 'VERIFIED'}
                        </Text>
                      </View>
                      <Text style={styles.findingDesc}>{ev.ai_summary || ev.event_type}</Text>
                      {ev.evidence_ids?.length > 0 && (
                        <Text style={styles.evidenceLink}>
                          Source Evidence: <Text style={styles.monoLink}>{ev.evidence_ids[0]}</Text> →
                        </Text>
                      )}
                    </TouchableOpacity>
                  ))}
                  {parsedNarrativeSections?.blackmail.map((b, idx) => (
                    <View key={`nb-${idx}`} style={[styles.card, { borderLeftColor: Colors.crimson }]}>
                      <Text style={styles.findingDesc}>{b}</Text>
                    </View>
                  ))}
                </>
              )}
            </View>

            {/* ── PAYMENT / FINANCIAL DEMANDS ── */}
            <View style={styles.sectionContainer}>
              <View style={styles.sectionHeaderRow}>
                <Text style={[styles.sectionTitle, { color: Colors.amber }]}>PAYMENT & FINANCIAL DEMANDS</Text>
                <Text style={styles.countBadge}>{demandEvents.length + (parsedNarrativeSections?.paymentDemands.length || 0)}</Text>
              </View>

              {demandEvents.length === 0 && (!parsedNarrativeSections || parsedNarrativeSections.paymentDemands.length === 0) ? (
                <View style={styles.emptyCategoryCard}>
                  <Text style={styles.emptyCategoryText}>No financial demands or payment identifiers logged.</Text>
                </View>
              ) : (
                <>
                  {demandEvents.map((ev) => (
                    <TouchableOpacity
                      key={ev.id}
                      style={[styles.card, { borderLeftColor: Colors.amber }]}
                      onPress={() => {
                        if (ev.evidence_ids && ev.evidence_ids.length > 0) {
                          router.push(`/evidence/${ev.evidence_ids[0]}`);
                        }
                      }}
                      activeOpacity={0.8}
                    >
                      <View style={styles.findingCardHeader}>
                        <Text style={styles.findingTypeBadge}>DEMAND EVENT</Text>
                        <Text style={styles.certaintyBadge}>
                          {ev.ai_summary?.includes('[INFERRED]') ? 'INFERRED' : 'VERIFIED'}
                        </Text>
                      </View>
                      <Text style={styles.findingDesc}>{ev.ai_summary || ev.event_type}</Text>
                      {ev.evidence_ids?.length > 0 && (
                        <Text style={styles.evidenceLink}>
                          Source Evidence: <Text style={styles.monoLink}>{ev.evidence_ids[0]}</Text> →
                        </Text>
                      )}
                    </TouchableOpacity>
                  ))}
                  {parsedNarrativeSections?.paymentDemands.map((p, idx) => (
                    <View key={`np-${idx}`} style={[styles.card, { borderLeftColor: Colors.amber }]}>
                      <Text style={styles.findingDesc}>{p}</Text>
                    </View>
                  ))}
                </>
              )}
            </View>

            {/* ── COERCION INDICATORS ── */}
            <View style={styles.sectionContainer}>
              <View style={styles.sectionHeaderRow}>
                <Text style={[styles.sectionTitle, { color: Colors.ink }]}>COERCION INDICATORS</Text>
                <Text style={styles.countBadge}>{coercionEvents.length + (parsedNarrativeSections?.coercion.length || 0)}</Text>
              </View>

              {coercionEvents.length === 0 && (!parsedNarrativeSections || parsedNarrativeSections.coercion.length === 0) ? (
                <View style={styles.emptyCategoryCard}>
                  <Text style={styles.emptyCategoryText}>No coercion indicators logged.</Text>
                </View>
              ) : (
                <>
                  {coercionEvents.map((ev) => (
                    <TouchableOpacity
                      key={ev.id}
                      style={[styles.card, { borderLeftColor: Colors.ink }]}
                      onPress={() => {
                        if (ev.evidence_ids && ev.evidence_ids.length > 0) {
                          router.push(`/evidence/${ev.evidence_ids[0]}`);
                        }
                      }}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.findingDesc}>{ev.ai_summary || ev.event_type}</Text>
                    </TouchableOpacity>
                  ))}
                  {parsedNarrativeSections?.coercion.map((c, idx) => (
                    <View key={`nc-${idx}`} style={[styles.card, { borderLeftColor: Colors.ink }]}>
                      <Text style={styles.findingDesc}>{c}</Text>
                    </View>
                  ))}
                </>
              )}
            </View>

            {/* ── ACTORS & IDENTIFIERS ── */}
            <View style={styles.sectionContainer}>
              <View style={styles.sectionHeaderRow}>
                <Text style={[styles.sectionTitle, { color: Colors.primary }]}>ACTORS & IDENTIFIERS</Text>
                <Text style={styles.countBadge}>{actors.length}</Text>
              </View>

              {actors.length === 0 ? (
                <View style={styles.emptyCategoryCard}>
                  <Text style={styles.emptyCategoryText}>No actors extracted yet.</Text>
                </View>
              ) : (
                actors.map((act) => (
                  <View key={act.id} style={styles.card}>
                    <View style={styles.findingCardHeader}>
                      <Text style={styles.actorName}>{act.name}</Text>
                      <Text style={[styles.actorRoleBadge, { color: act.role === 'offender' ? Colors.crimson : Colors.primary }]}>
                        {act.role.toUpperCase()}
                      </Text>
                    </View>

                    {act.identifiers && act.identifiers.length > 0 ? (
                      <View style={styles.identList}>
                        <Text style={styles.identLabel}>IDENTIFIERS:</Text>
                        {act.identifiers.map((ident, i) => (
                          <Text key={i} style={styles.identItem}>
                            • <Text style={styles.identType}>{ident.type}:</Text> {ident.value}
                          </Text>
                        ))}
                      </View>
                    ) : null}

                    {act.uncertainty_notes && act.uncertainty_notes.length > 0 ? (
                      <Text style={styles.uncertaintyNote}>
                        Uncertainty: {act.uncertainty_notes.join('; ')}
                      </Text>
                    ) : null}
                  </View>
                ))
              )}
            </View>

            {/* ── FORENSIC UNCERTAINTIES & AUDIT REJECTIONS ── */}
            {parsedNarrativeSections?.uncertainties && parsedNarrativeSections.uncertainties.length > 0 && (
              <View style={styles.sectionContainer}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={[styles.sectionTitle, { color: Colors.amber }]}>
                    FORENSIC UNCERTAINTIES & VALIDATION AUDIT
                  </Text>
                </View>

                {parsedNarrativeSections.uncertainties.map((u, idx) => (
                  <View key={`nu-${idx}`} style={[styles.card, { borderLeftColor: Colors.amber }]}>
                    <Text style={styles.findingDesc}>{u}</Text>
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

function parseNarrativeText(content: string) {
  const lines = content.split('\n');
  let currentSection = '';
  let summary = '';
  const threats: string[] = [];
  const blackmail: string[] = [];
  const coercion: string[] = [];
  const paymentDemands: string[] = [];
  const uncertainties: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('### Incident Summary')) {
      currentSection = 'SUMMARY';
      continue;
    } else if (trimmed.startsWith('### Threats Detected')) {
      currentSection = 'THREATS';
      continue;
    } else if (trimmed.startsWith('### Blackmail')) {
      currentSection = 'BLACKMAIL';
      continue;
    } else if (trimmed.startsWith('### Coercion')) {
      currentSection = 'COERCION';
      continue;
    } else if (trimmed.startsWith('### Payment')) {
      currentSection = 'PAYMENTS';
      continue;
    } else if (trimmed.startsWith('### Forensic Uncertainties')) {
      currentSection = 'UNCERTAINTIES';
      continue;
    } else if (trimmed.startsWith('###')) {
      currentSection = 'OTHER';
      continue;
    }

    if (!trimmed) continue;

    if (currentSection === 'SUMMARY') {
      summary += (summary ? ' ' : '') + trimmed;
    } else if (currentSection === 'THREATS' && trimmed.startsWith('-')) {
      threats.push(trimmed.replace(/^- /, ''));
    } else if (currentSection === 'BLACKMAIL' && trimmed.startsWith('-')) {
      blackmail.push(trimmed.replace(/^- /, ''));
    } else if (currentSection === 'COERCION' && trimmed.startsWith('-')) {
      coercion.push(trimmed.replace(/^- /, ''));
    } else if (currentSection === 'PAYMENTS' && trimmed.startsWith('-')) {
      paymentDemands.push(trimmed.replace(/^- /, ''));
    } else if (currentSection === 'UNCERTAINTIES' && trimmed.startsWith('-')) {
      uncertainties.push(trimmed.replace(/^- /, ''));
    }
  }

  return { summary, threats, blackmail, coercion, paymentDemands, uncertainties };
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
  sectionContainer: { marginBottom: 18 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  sectionTitle: {
    ...Typography.subtopLabel,
    fontSize: 12,
    color: Colors.textMuted,
  },
  countBadge: {
    ...Typography.subtopLabel,
    fontSize: 11,
    color: Colors.ink,
    backgroundColor: Colors.cardBg,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  card: {
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderLeftWidth: 3.5,
    padding: 14,
    marginBottom: 10,
    ...Shadows.card,
  },
  summaryText: {
    ...Typography.body,
    fontSize: 13,
    color: Colors.ink,
    lineHeight: 20,
  },
  findingCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  findingTypeBadge: {
    ...Typography.subtopLabel,
    fontSize: 10,
    color: Colors.textMuted,
  },
  certaintyBadge: {
    ...Typography.subtopLabel,
    fontSize: 9,
    color: Colors.primary,
    backgroundColor: Colors.primarySubtle,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  findingDesc: {
    ...Typography.body,
    fontSize: 13,
    color: Colors.ink,
    lineHeight: 19,
    marginBottom: 6,
  },
  evidenceLink: {
    ...Typography.body,
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 4,
  },
  monoLink: {
    ...Typography.mono,
    color: Colors.primary,
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
  actorName: {
    ...Typography.headline,
    fontSize: 16,
    color: Colors.ink,
  },
  actorRoleBadge: {
    ...Typography.subtopLabel,
    fontSize: 11,
  },
  identList: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  identLabel: {
    ...Typography.subtopLabel,
    fontSize: 10,
    color: Colors.textMuted,
    marginBottom: 3,
  },
  identItem: {
    ...Typography.body,
    fontSize: 12,
    color: Colors.ink,
    marginBottom: 2,
  },
  identType: {
    color: Colors.primary,
  },
  uncertaintyNote: {
    ...Typography.body,
    fontSize: 11,
    fontStyle: 'italic',
    color: Colors.amber,
    marginTop: 4,
  },
});

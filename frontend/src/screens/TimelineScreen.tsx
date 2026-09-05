import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { useCaseStore } from '../store/caseStore';
import { useAiStore } from '../store/aiStore';
import { databaseService } from '../services/databaseService';
import { aiService } from '../services/aiService';
import { AppHeader } from '../components/AppHeader';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { EmptyState } from '../components/EmptyState';
import { EventReviewModal } from '../components/EventReviewModal';
import { TimelineEventCard } from '../components/TimelineEventCard';
import { TimelineEventDetailModal } from '../components/TimelineEventDetailModal';
import { TimelineFilters } from '../components/TimelineFilters';
import { EventRecord, EvidenceItem, ActorRecord, IncidentSeverity, MediaCategory } from '../types';
import { palette } from '../theme';
import { RECONSTRUCTION_DISCLAIMER } from '../../../ai/clustering/eventTypes';

export function TimelineScreen() {
  const activeCase = useCaseStore((state) => state.activeCase);
  const { progress, setProgress, clusterResult, setClusterResult } = useAiStore();

  const [events, setEvents] = useState<EventRecord[]>([]);
  const [allEvidence, setAllEvidence] = useState<EvidenceItem[]>([]);
  const [allActors, setAllActors] = useState<ActorRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [clustering, setClustering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedEvent, setSelectedEvent] = useState<EventRecord | null>(null);
  const [detailEvent, setDetailEvent] = useState<EventRecord | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);

  const [selectedSeverities, setSelectedSeverities] = useState<IncidentSeverity[]>([1, 2, 3, 4, 5]);
  const [selectedActors, setSelectedActors] = useState<string[]>([]);
  const [selectedMediaTypes, setSelectedMediaTypes] = useState<MediaCategory[]>(['IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT']);
  const [searchQuery, setSearchQuery] = useState('');

  const load = useCallback(async () => {
    if (!activeCase?.id) {
      setEvents([]);
      setAllEvidence([]);
      setAllActors([]);
      setIsLoading(false);
      return;
    }
    setError(null);
    try {
      const [evs, evidence, actors] = await Promise.all([
        databaseService.getEventRecordsForCase(activeCase.id),
        databaseService.getEvidenceForCase(activeCase.id),
        databaseService.getActorsForCase(activeCase.id),
      ]);
      setEvents([...evs].sort((a, b) => a.timestamp - b.timestamp));
      setAllEvidence(evidence);
      setAllActors(actors);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load timeline');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [activeCase?.id]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  useEffect(() => {
    setIsLoading(true);
    load();
  }, [load]);

  const runClustering = async () => {
    if (!activeCase?.id) {
      Alert.alert('No active case', 'Open a case before clustering incident events.');
      return;
    }
    setClustering(true);
    try {
      const result = await aiService.clusterIncidentEvents(activeCase.id, {
        onProgress: (next) => setProgress({
          stage: next.stage as typeof progress.stage,
          completedChunks: next.completedChunks,
          totalChunks: next.totalChunks,
          message: next.message,
        }),
      });
      setClusterResult(result);
      await load();
    } catch (err) {
      Alert.alert('Clustering failed', err instanceof Error ? err.message : 'Local clustering failed.');
    } finally {
      setClustering(false);
    }
  };

  const handleSeverityToggle = (severity: IncidentSeverity) => {
    setSelectedSeverities((prev) =>
      prev.includes(severity) ? prev.filter((s) => s !== severity) : [...prev, severity]
    );
  };

  const handleActorToggle = (actorId: string) => {
    setSelectedActors((prev) =>
      prev.includes(actorId) ? prev.filter((a) => a !== actorId) : [...prev, actorId]
    );
  };

  const handleMediaTypeToggle = (mediaType: MediaCategory) => {
    setSelectedMediaTypes((prev) =>
      prev.includes(mediaType) ? prev.filter((m) => m !== mediaType) : [...prev, mediaType]
    );
  };

  const clearAllFilters = () => {
    setSelectedSeverities([1, 2, 3, 4, 5]);
    setSelectedActors([]);
    setSelectedMediaTypes(['IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT']);
    setSearchQuery('');
  };

  const hasActiveFilters = useMemo(() => {
    return (
      selectedSeverities.length !== 5 ||
      selectedActors.length > 0 ||
      selectedMediaTypes.length !== 4 ||
      searchQuery.trim() !== ''
    );
  }, [selectedSeverities, selectedActors, selectedMediaTypes, searchQuery]);

  const filteredEvents = useMemo(() => {
    let result = events;

    if (selectedSeverities.length < 5) {
      result = result.filter((e) => selectedSeverities.includes(e.severity));
    }

    if (selectedActors.length > 0) {
      result = result.filter((e) => e.actor_ids?.some((a) => selectedActors.includes(a)));
    }

    if (selectedMediaTypes.length < 4) {
      result = result.filter((e) =>
        e.evidence_ids?.some((eid) => {
          const ev = allEvidence.find((e) => e.id === eid);
          return ev && selectedMediaTypes.includes(ev.type);
        })
      );
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(
        (e) =>
          e.event_type.toLowerCase().includes(query) ||
          e.ai_summary?.toLowerCase().includes(query) ||
          e.user_annotation?.toLowerCase().includes(query) ||
          e.timestamp_hint?.toLowerCase().includes(query) ||
          e.evidence_ids?.some((id) => id.toLowerCase().includes(query))
      );
    }

    return result;
  }, [events, selectedSeverities, selectedActors, selectedMediaTypes, searchQuery, allEvidence]);

  const getPrimaryEvidence = (event: EventRecord): EvidenceItem | null => {
    if (!event.evidence_ids?.length) return null;
    const primaryId = event.evidence_ids[0];
    return allEvidence.find((e) => e.id === primaryId) || null;
  };

  const handleEventPress = (event: EventRecord) => {
    setDetailEvent(event);
    setDetailVisible(true);
  };

  const handleEventReviewPress = (event: EventRecord) => {
    setSelectedEvent(event);
  };

  return (
    <View style={styles.container}>
      <AppHeader title="Case Timeline" subtitle="AI incident reconstruction — review required" />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[palette.primary]} />
        }
      >
        <View style={styles.disclaimerContainer}>
          <Text style={styles.disclaimer}>{RECONSTRUCTION_DISCLAIMER}</Text>
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.clusterBtn} onPress={runClustering} disabled={clustering}>
            <Text style={styles.clusterBtnText}>
              {clustering ? 'Clustering on device…' : 'Cluster incident events'}
            </Text>
          </TouchableOpacity>
        </View>

        {clustering && <Text style={styles.progress}>{progress.message}</Text>}
        {clusterResult && (
          <Text style={styles.meta}>
            Accepted {clusterResult.persisted.length} · Rejected {clusterResult.rejected.length}
            {clusterResult.skippedReason ? ` · ${clusterResult.skippedReason}` : ''}
          </Text>
        )}

        {error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>⚠️ {error}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={onRefresh}>
              <Text style={styles.retryBtnText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        <TimelineFilters
          selectedSeverities={selectedSeverities}
          onSeverityToggle={handleSeverityToggle}
          selectedActors={selectedActors}
          onActorToggle={handleActorToggle}
          availableActors={allActors}
          selectedMediaTypes={selectedMediaTypes}
          onMediaTypeToggle={handleMediaTypeToggle}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onClearAll={clearAllFilters}
          hasActiveFilters={hasActiveFilters}
        />

        {isLoading ? (
          <LoadingSpinner label="Loading timeline..." />
        ) : filteredEvents.length === 0 ? (
          <EmptyState
            title={events.length === 0 ? 'Timeline Empty' : 'No Matching Events'}
            message={
              events.length === 0
                ? 'No chronological events logged yet. Run clustering to reconstruct events from evidence.'
                : 'Try adjusting your filters or search query.'
            }
          />
        ) : (
          <View style={styles.timelineContainer}>
            {filteredEvents.map((ev, index) => (
              <TimelineEventCard
                key={ev.id}
                event={ev}
                index={index}
                total={filteredEvents.length}
                primaryEvidence={getPrimaryEvidence(ev)}
                onPress={() => handleEventPress(ev)}
                isSelected={detailEvent?.id === ev.id}
              />
            ))}
          </View>
        )}
      </ScrollView>

      <EventReviewModal
        event={selectedEvent}
        visible={!!selectedEvent}
        onClose={() => setSelectedEvent(null)}
        onSave={async (updates) => {
          if (!selectedEvent) return;
          await aiService.annotateClusterEvent(selectedEvent.id, updates);
          await load();
        }}
      />

      <TimelineEventDetailModal
        event={detailEvent}
        visible={detailVisible}
        onClose={() => setDetailVisible(false)}
        caseId={activeCase?.id || ''}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.background },
  scrollView: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  disclaimerContainer: { marginBottom: 12 },
  disclaimer: { color: palette.warning, fontSize: 12, lineHeight: 18 },
  actionRow: { marginBottom: 12 },
  clusterBtn: {
    backgroundColor: palette.primary,
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
  },
  clusterBtnText: { color: '#041018', fontWeight: 'bold', fontSize: 14 },
  progress: { color: palette.textSecondary, marginBottom: 8, fontSize: 13 },
  meta: { color: palette.textSecondary, fontSize: 12, marginBottom: 12 },
  errorBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: palette.error,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  errorText: { color: palette.error, fontSize: 13, flex: 1 },
  retryBtn: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: palette.error,
    borderRadius: 6,
  },
  retryBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
  timelineContainer: { gap: 0 },
});
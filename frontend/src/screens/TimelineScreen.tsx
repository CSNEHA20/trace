import React, { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useCaseStore } from '../store/caseStore';
import { useAiStore } from '../store/aiStore';
import { databaseService } from '../services/databaseService';
import { aiService } from '../services/aiService';
import { AppHeader } from '../components/AppHeader';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { EmptyState } from '../components/EmptyState';
import { EventReviewModal } from '../components/EventReviewModal';
import { EventRecord } from '../types';
import { palette } from '../theme';
import { formatDate } from '../utils/crypto';
import { RECONSTRUCTION_DISCLAIMER } from '../../../ai/clustering/eventTypes';

export function TimelineScreen() {
  const activeCase = useCaseStore((state) => state.activeCase);
  const { progress, setProgress, clusterResult, setClusterResult } = useAiStore();
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [clustering, setClustering] = useState(false);
  const [selected, setSelected] = useState<EventRecord | null>(null);

  const load = useCallback(async () => {
    if (!activeCase?.id) {
      setEvents([]);
      setIsLoading(false);
      return;
    }
    const recs = await databaseService.getEventRecordsForCase(activeCase.id);
    setEvents([...recs].sort((a, b) => a.timestamp - b.timestamp));
    setIsLoading(false);
  }, [activeCase?.id]);

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
    } catch (error) {
      Alert.alert('Clustering failed', error instanceof Error ? error.message : 'Local clustering failed.');
    } finally {
      setClustering(false);
    }
  };

  return (
    <View style={styles.container}>
      <AppHeader title="Case Timeline" subtitle="AI incident reconstruction — review required" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.disclaimer}>{RECONSTRUCTION_DISCLAIMER}</Text>
        <TouchableOpacity style={styles.clusterBtn} onPress={runClustering} disabled={clustering}>
          <Text style={styles.clusterBtnText}>{clustering ? 'Clustering on device…' : 'Cluster incident events'}</Text>
        </TouchableOpacity>
        {clustering ? <Text style={styles.progress}>{progress.message}</Text> : null}
        {clusterResult ? (
          <Text style={styles.meta}>
            Accepted {clusterResult.persisted.length} · Rejected {clusterResult.rejected.length}
            {clusterResult.skippedReason ? ` · ${clusterResult.skippedReason}` : ''}
          </Text>
        ) : null}
        {isLoading ? (
          <LoadingSpinner label="Loading timeline..." />
        ) : events.length === 0 ? (
          <EmptyState title="Timeline Empty" message="No chronological events logged yet." />
        ) : (
          events.map((ev, index) => (
            <View key={ev.id} style={styles.timelineNode}>
              <View style={styles.lineCol}>
                <View style={styles.dot} />
                {index < events.length - 1 ? <View style={styles.line} /> : null}
              </View>
              <View style={styles.nodeContent}>
                <View style={styles.nodeHeader}>
                  <Text style={styles.category}>{ev.event_type}</Text>
                  <Text style={styles.date}>{ev.timestamp ? formatDate(ev.timestamp) : 'Unresolved time'}</Text>
                </View>
                <Text style={styles.title}>{ev.ai_summary || ev.event_type}</Text>
                <Text style={styles.desc}>Severity {ev.severity} · Source {ev.source || 'system'}</Text>
                {ev.timestamp_hint ? <Text style={styles.desc}>Hint: {ev.timestamp_hint}</Text> : null}
                {ev.timestamp_conflict ? <Text style={styles.warn}>Contradictory timestamps flagged</Text> : null}
                {ev.timestamp_unresolved ? <Text style={styles.warn}>Timestamp unresolved from evidence</Text> : null}
                {ev.evidence_ids?.length ? <Text style={styles.desc}>Evidence: {ev.evidence_ids.join(', ')}</Text> : null}
                {ev.user_annotation ? <Text style={styles.actor}>Annotation: {ev.user_annotation}</Text> : null}
                {ev.source === 'ai' ? (
                  <TouchableOpacity onPress={() => setSelected(ev)}>
                    <Text style={styles.edit}>Edit / annotate</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          ))
        )}
      </ScrollView>
      <EventReviewModal
        event={selected}
        visible={!!selected}
        onClose={() => setSelected(null)}
        onSave={async (updates) => {
          if (!selected) return;
          await aiService.annotateClusterEvent(selected.id, updates);
          await load();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.background },
  content: { padding: 20 },
  disclaimer: { color: palette.warning, fontSize: 12, lineHeight: 18, marginBottom: 12 },
  clusterBtn: { backgroundColor: palette.primary, borderRadius: 10, padding: 12, alignItems: 'center', marginBottom: 12 },
  clusterBtnText: { color: '#041018', fontWeight: 'bold' },
  progress: { color: palette.textSecondary, marginBottom: 8 },
  meta: { color: palette.textSecondary, fontSize: 12, marginBottom: 12 },
  timelineNode: { flexDirection: 'row', marginBottom: 20 },
  lineCol: { alignItems: 'center', marginRight: 14 },
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: palette.primary, marginTop: 4 },
  line: { width: 2, flex: 1, backgroundColor: palette.border, marginTop: 4 },
  nodeContent: { flex: 1, backgroundColor: palette.card, borderRadius: 10, padding: 14, borderWidth: 1, borderColor: palette.border },
  nodeHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  category: { fontSize: 11, fontWeight: 'bold', color: palette.secondary },
  date: { fontSize: 11, color: palette.textSecondary },
  title: { fontSize: 15, fontWeight: 'bold', color: palette.text, marginBottom: 4 },
  desc: { fontSize: 12, color: palette.textSecondary, marginBottom: 6 },
  warn: { fontSize: 12, color: palette.warning, marginBottom: 6 },
  actor: { fontSize: 11, color: palette.accent, fontWeight: '600' },
  edit: { color: palette.primary, fontWeight: 'bold', marginTop: 6 },
});

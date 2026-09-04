import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useCaseStore } from '../store/caseStore';
import { databaseService } from '../services/databaseService';
import { AppHeader } from '../components/AppHeader';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { EmptyState } from '../components/EmptyState';
import { TimelineEvent } from '../types';
import { palette } from '../theme';
import { formatDate } from '../utils/crypto';

export function TimelineScreen() {
  const activeCase = useCaseStore((state) => state.activeCase);
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    databaseService.getAllTimelineEvents().then((evs) => {
      setEvents(evs);
      setIsLoading(false);
    });
  }, [activeCase?.id]);

  return (
    <View style={styles.container}>
      <AppHeader title="Case Timeline" subtitle="Chronological Evidence Audit Trail" />
      <ScrollView contentContainerStyle={styles.content}>
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
                  <Text style={styles.category}>{ev.category}</Text>
                  <Text style={styles.date}>{formatDate(ev.timestamp)}</Text>
                </View>
                <Text style={styles.title}>{ev.title}</Text>
                <Text style={styles.desc}>{ev.description}</Text>
                {ev.actor ? <Text style={styles.actor}>Actor: {ev.actor}</Text> : null}
              </View>
            </View>
          ))
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
  content: {
    padding: 20,
  },
  timelineNode: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  lineCol: {
    alignItems: 'center',
    marginRight: 14,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: palette.primary,
    marginTop: 4,
  },
  line: {
    width: 2,
    flex: 1,
    backgroundColor: palette.border,
    marginTop: 4,
  },
  nodeContent: {
    flex: 1,
    backgroundColor: palette.card,
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: palette.border,
  },
  nodeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  category: {
    fontSize: 11,
    fontWeight: 'bold',
    color: palette.secondary,
  },
  date: {
    fontSize: 11,
    color: palette.textSecondary,
  },
  title: {
    fontSize: 15,
    fontWeight: 'bold',
    color: palette.text,
    marginBottom: 4,
  },
  desc: {
    fontSize: 12,
    color: palette.textSecondary,
    marginBottom: 6,
  },
  actor: {
    fontSize: 11,
    color: palette.accent,
    fontWeight: '600',
  },
});

import React, { useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { EventRecord, IncidentEventType, IncidentSeverity } from '../types';
import { INCIDENT_EVENT_TYPES } from '../../../ai/clustering/eventTypes';
import { palette } from '../theme';

interface EventReviewModalProps {
  event: EventRecord | null;
  visible: boolean;
  onClose: () => void;
  onSave: (updates: {
    event_type: IncidentEventType;
    severity: IncidentSeverity;
    ai_summary: string;
    user_annotation: string;
    timestamp_hint: string | null;
  }) => Promise<void>;
}

export function EventReviewModal({ event, visible, onClose, onSave }: EventReviewModalProps) {
  const [eventType, setEventType] = useState<IncidentEventType>('other');
  const [severity, setSeverity] = useState<IncidentSeverity>(3);
  const [summary, setSummary] = useState('');
  const [annotation, setAnnotation] = useState('');
  const [hint, setHint] = useState('');
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    if (!event) return;
    setEventType((INCIDENT_EVENT_TYPES as readonly string[]).includes(event.event_type)
      ? (event.event_type as IncidentEventType)
      : 'other');
    setSeverity(event.severity);
    setSummary(event.ai_summary || '');
    setAnnotation(event.user_annotation || '');
    setHint(event.timestamp_hint || '');
    setError(null);
  }, [event]);

  const save = async () => {
    if (!summary.trim()) {
      setError('Summary cannot be empty.');
      return;
    }
    try {
      await onSave({
        event_type: eventType,
        severity,
        ai_summary: summary.trim(),
        user_annotation: annotation.trim(),
        timestamp_hint: hint.trim() ? hint.trim() : null,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save annotation.');
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Review AI event</Text>
          <Text style={styles.disclaimer}>
            This reconstruction is not unquestionable truth. Edit type, severity, summary, and add your annotation.
          </Text>
          <ScrollView>
            <Text style={styles.label}>Event type</Text>
            <View style={styles.wrap}>
              {INCIDENT_EVENT_TYPES.map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[styles.chip, eventType === type && styles.chipActive]}
                  onPress={() => setEventType(type)}
                >
                  <Text style={styles.chipText}>{type}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.label}>Severity</Text>
            <View style={styles.wrap}>
              {([1, 2, 3, 4, 5] as IncidentSeverity[]).map((value) => (
                <TouchableOpacity
                  key={value}
                  style={[styles.chip, severity === value && styles.chipActive]}
                  onPress={() => setSeverity(value)}
                >
                  <Text style={styles.chipText}>{value}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.label}>Summary</Text>
            <TextInput style={styles.input} multiline value={summary} onChangeText={setSummary} />
            <Text style={styles.label}>Timestamp hint</Text>
            <TextInput style={styles.input} value={hint} onChangeText={setHint} />
            <Text style={styles.label}>Investigator annotation</Text>
            <TextInput style={styles.input} multiline value={annotation} onChangeText={setAnnotation} />
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </ScrollView>
          <View style={styles.actions}>
            <TouchableOpacity onPress={onClose}><Text style={styles.cancel}>Cancel</Text></TouchableOpacity>
            <TouchableOpacity onPress={save}><Text style={styles.save}>Save review</Text></TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#ffffff',
    padding: 20,
    maxHeight: '88%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
  },
  title: { color: '#1d1d1f', fontSize: 18, fontWeight: '700', letterSpacing: -0.3, marginBottom: 6 },
  disclaimer: { color: '#b45309', fontSize: 12, lineHeight: 17, marginBottom: 12 },
  label: { color: '#86868b', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 12, marginBottom: 6 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    borderRadius: 9999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#ffffff',
  },
  chipActive: { borderColor: '#0066cc', backgroundColor: '#e8f0fe' },
  chipText: { color: '#1d1d1f', fontSize: 12, fontWeight: '500' },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    borderRadius: 12,
    color: '#1d1d1f',
    padding: 12,
    minHeight: 44,
    backgroundColor: '#f5f5f7',
    fontSize: 14,
  },
  error: { color: '#dc2626', marginTop: 8, fontSize: 12 },
  actions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.06)' },
  cancel: { color: '#6e6e73', fontWeight: '600', fontSize: 14, paddingHorizontal: 12, paddingVertical: 8 },
  save: {
    backgroundColor: '#0066cc',
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 9999,
    overflow: 'hidden',
  },
});

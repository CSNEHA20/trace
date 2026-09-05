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
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: palette.surface, padding: 16, maxHeight: '88%', borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  title: { color: palette.text, fontSize: 18, fontWeight: 'bold', marginBottom: 8 },
  disclaimer: { color: palette.warning, fontSize: 12, lineHeight: 18, marginBottom: 12 },
  label: { color: palette.textSecondary, fontSize: 12, fontWeight: 'bold', marginTop: 10, marginBottom: 6 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderColor: palette.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  chipActive: { borderColor: palette.primary, backgroundColor: palette.surfaceVariant },
  chipText: { color: palette.text, fontSize: 11 },
  input: { borderWidth: 1, borderColor: palette.border, borderRadius: 8, color: palette.text, padding: 10, minHeight: 44 },
  error: { color: palette.error, marginTop: 8 },
  actions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  cancel: { color: palette.textSecondary, fontWeight: 'bold' },
  save: { color: palette.primary, fontWeight: 'bold' },
});

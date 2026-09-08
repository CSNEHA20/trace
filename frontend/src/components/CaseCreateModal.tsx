import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { palette } from '../theme';
import { useCaseStore } from '../store/caseStore';

interface CaseCreateModalProps {
  visible: boolean;
  onClose: () => void;
  onCaseCreated?: (caseId: string) => void;
}

export function CaseCreateModal({ visible, onClose, onCaseCreated }: CaseCreateModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [investigatorName, setInvestigatorName] = useState('Investigator Sneha C');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const createCase = useCaseStore((state) => state.createCase);

  const handleSubmit = async () => {
    if (!title.trim()) {
      Alert.alert('Validation Error', 'Case title is required.');
      return;
    }

    setIsSubmitting(true);
    try {
      const newCase = await createCase(
        title.trim(),
        description.trim() || 'No description provided.',
        investigatorName.trim() || 'Forensic Investigator'
      );
      setTitle('');
      setDescription('');
      setIsSubmitting(false);
      onClose();
      onCaseCreated?.(newCase.id);
    } catch (err: unknown) {
      setIsSubmitting(false);
      Alert.alert('Error', (err as Error)?.message || 'Failed to create case in SQLite database.');
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.dialog}>
          <Text style={styles.title}>Initialize Forensic Case</Text>
          <Text style={styles.subtitle}>Creates an authoritative case ledger in encrypted SQLite.</Text>

          <Text style={styles.label}>CASE TITLE *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., Cyber Extortion Incident 2026-09"
            placeholderTextColor={palette.textSecondary}
            value={title}
            onChangeText={setTitle}
          />

          <Text style={styles.label}>DESCRIPTION</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            placeholder="Initial details, suspected threat actors, incident context..."
            placeholderTextColor={palette.textSecondary}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={3}
          />

          <Text style={styles.label}>INVESTIGATOR NAME</Text>
          <TextInput
            style={styles.input}
            placeholder="Investigator name"
            placeholderTextColor={palette.textSecondary}
            value={investigatorName}
            onChangeText={setInvestigatorName}
          />

          <View style={styles.btnRow}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} disabled={isSubmitting}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? (
                <ActivityIndicator color="#041018" size="small" />
              ) : (
                <Text style={styles.submitBtnText}>Create Case</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  dialog: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: palette.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: palette.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    color: palette.textSecondary,
    marginBottom: 16,
  },
  label: {
    fontSize: 11,
    fontWeight: 'bold',
    color: palette.primary,
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: palette.background,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: palette.text,
    fontSize: 14,
    marginBottom: 14,
  },
  multiline: {
    height: 72,
    textAlignVertical: 'top',
  },
  btnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 8,
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.border,
  },
  cancelBtnText: {
    color: palette.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  submitBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: palette.primary,
    minWidth: 100,
    alignItems: 'center',
  },
  submitBtnText: {
    color: '#041018',
    fontSize: 14,
    fontWeight: 'bold',
  },
});

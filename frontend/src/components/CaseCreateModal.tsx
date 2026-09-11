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
import { colors, rounded, typography } from '../theme';
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
            placeholderTextColor={colors.inkMuted48}
            value={title}
            onChangeText={setTitle}
          />

          <Text style={styles.label}>DESCRIPTION</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            placeholder="Initial details, suspected threat actors, incident context..."
            placeholderTextColor={colors.inkMuted48}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={3}
          />

          <Text style={styles.label}>INVESTIGATOR NAME</Text>
          <TextInput
            style={styles.input}
            placeholder="Investigator name"
            placeholderTextColor={colors.inkMuted48}
            value={investigatorName}
            onChangeText={setInvestigatorName}
          />

          <View style={styles.btnRow}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} disabled={isSubmitting} activeOpacity={0.8}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={isSubmitting} activeOpacity={0.8}>
              {isSubmitting ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
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
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  dialog: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: colors.canvas,
    borderRadius: rounded.xl,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: 22,
    elevation: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.ink,
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '400',
    color: colors.bodyMuted,
    marginBottom: 18,
    letterSpacing: -0.1,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.inkMuted80,
    marginBottom: 6,
    letterSpacing: 0.2,
  },
  input: {
    backgroundColor: colors.canvasParchment,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: rounded.sm,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: colors.ink,
    fontSize: 14,
    fontWeight: '400',
    marginBottom: 14,
  },
  multiline: {
    height: 72,
    textAlignVertical: 'top',
  },
  btnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 8,
  },
  cancelBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: rounded.pill,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surfacePearl,
  },
  cancelBtnText: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '500',
  },
  submitBtn: {
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: rounded.pill,
    backgroundColor: colors.primary,
    minWidth: 110,
    alignItems: 'center',
  },
  submitBtnText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
});

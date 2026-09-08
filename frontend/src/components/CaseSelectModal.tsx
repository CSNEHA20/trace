import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { palette } from '../theme';
import { Case } from '../types';
import { formatDate } from '../utils/crypto';

interface CaseSelectModalProps {
  visible: boolean;
  cases: Case[];
  activeCaseId?: string;
  onClose: () => void;
  onSelectCase: (caseId: string) => void;
  onCreateNewPress: () => void;
}

export function CaseSelectModal({
  visible,
  cases,
  activeCaseId,
  onClose,
  onSelectCase,
  onCreateNewPress,
}: CaseSelectModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.dialog}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>Select Forensic Case</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.subtitle}>Choose an authoritative case file from SQLite</Text>

          <ScrollView style={styles.caseList} contentContainerStyle={styles.caseListContent}>
            {cases.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No forensic cases found.</Text>
              </View>
            ) : (
              cases.map((c) => {
                const isActive = c.id === activeCaseId;
                return (
                  <TouchableOpacity
                    key={c.id}
                    style={[styles.caseItem, isActive && styles.caseItemActive]}
                    onPress={() => {
                      onSelectCase(c.id);
                      onClose();
                    }}
                  >
                    <View style={styles.caseItemHeader}>
                      <Text style={styles.caseNumber}>{c.caseNumber}</Text>
                      {isActive && <Text style={styles.activeBadge}>ACTIVE</Text>}
                    </View>
                    <Text style={styles.caseTitle} numberOfLines={1}>{c.title}</Text>
                    <Text style={styles.caseMeta}>
                      Investigator: {c.investigatorName} · Created: {formatDate(c.createdAt)}
                    </Text>
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>

          <View style={styles.footerRow}>
            <TouchableOpacity
              style={styles.newCaseBtn}
              onPress={() => {
                onClose();
                onCreateNewPress();
              }}
            >
              <Text style={styles.newCaseBtnText}>+ Initialize New Case</Text>
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
    maxWidth: 480,
    maxHeight: '80%',
    backgroundColor: palette.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 20,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: palette.text,
  },
  closeText: {
    color: palette.textSecondary,
    fontSize: 18,
    padding: 4,
  },
  subtitle: {
    fontSize: 12,
    color: palette.textSecondary,
    marginTop: 2,
    marginBottom: 16,
  },
  caseList: {
    maxHeight: 340,
  },
  caseListContent: {
    gap: 10,
  },
  emptyContainer: {
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    color: palette.textSecondary,
    fontSize: 13,
  },
  caseItem: {
    backgroundColor: palette.surfaceVariant,
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: palette.border,
  },
  caseItemActive: {
    borderColor: palette.primary,
    backgroundColor: 'rgba(0, 242, 254, 0.06)',
  },
  caseItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  caseNumber: {
    fontFamily: 'monospace',
    fontSize: 12,
    fontWeight: 'bold',
    color: palette.secondary,
  },
  activeBadge: {
    fontSize: 10,
    fontWeight: 'bold',
    color: palette.primary,
    backgroundColor: 'rgba(0, 242, 254, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  caseTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: palette.text,
    marginBottom: 4,
  },
  caseMeta: {
    fontSize: 11,
    color: palette.textSecondary,
  },
  footerRow: {
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: palette.border,
    paddingTop: 14,
  },
  newCaseBtn: {
    backgroundColor: palette.primary,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  newCaseBtnText: {
    color: '#041018',
    fontSize: 14,
    fontWeight: 'bold',
  },
});

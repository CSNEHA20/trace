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

          <ScrollView style={styles.list} contentContainerStyle={styles.caseListContent}>
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
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
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
    borderWidth: 1.5,
    borderColor: palette.borderDark,
    padding: 20,
    elevation: 6,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '900',
    color: palette.deepBlack,
    marginBottom: 4,
  },
  closeText: {
    color: palette.deepBlack,
    fontSize: 18,
    fontWeight: '800',
    padding: 4,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: palette.textSecondary,
    marginBottom: 16,
  },
  list: {
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
    fontWeight: '600',
  },
  caseItem: {
    backgroundColor: palette.surface,
    borderWidth: 1.5,
    borderColor: palette.borderDark,
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
  },
  caseItemActive: {
    borderColor: palette.brandYellow,
    backgroundColor: palette.brandYellowBg,
    borderWidth: 2,
    borderLeftWidth: 4,
    borderLeftColor: palette.brandYellow,
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
    fontWeight: '900',
    color: palette.deepBlack,
  },
  activeBadge: {
    fontSize: 10,
    fontWeight: '900',
    color: palette.deepBlack,
    backgroundColor: palette.brandYellow,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
  },
  caseTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: palette.deepBlack,
    marginBottom: 4,
  },
  caseMeta: {
    fontSize: 11,
    fontWeight: '600',
    color: palette.textSecondary,
  },
  footerRow: {
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: palette.border,
    paddingTop: 14,
  },
  newCaseBtn: {
    backgroundColor: palette.deepBlack,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    borderLeftWidth: 4,
    borderLeftColor: palette.brandYellow,
    elevation: 3,
  },
  newCaseBtnText: {
    color: palette.white,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});

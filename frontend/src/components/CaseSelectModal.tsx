import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { colors, rounded, typography } from '../theme';
import { Case } from '../types';
import { formatDate } from '../utils/crypto';
import { Ionicons } from '@expo/vector-icons';

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
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <Ionicons name="close" size={20} color={colors.inkMuted80} />
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
                    activeOpacity={0.8}
                  >
                    <View style={styles.caseItemHeader}>
                      <Text style={[styles.caseNumber, isActive && { color: colors.primary }]}>{c.caseNumber}</Text>
                      {isActive && (
                        <View style={styles.activeBadge}>
                          <Text style={styles.activeBadgeText}>ACTIVE</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.caseTitle} numberOfLines={1}>{c.title}</Text>
                    <Text style={styles.caseMeta}>
                      Investigator: {c.investigatorName} · {formatDate(c.createdAt)}
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
              activeOpacity={0.85}
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
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  dialog: {
    width: '100%',
    maxWidth: 440,
    maxHeight: '80%',
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.ink,
    letterSpacing: -0.3,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: rounded.full,
    backgroundColor: colors.canvasParchment,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '400',
    color: colors.bodyMuted,
    marginTop: 4,
    marginBottom: 16,
    letterSpacing: -0.1,
  },
  list: {
    maxHeight: 320,
  },
  caseListContent: {
    gap: 8,
  },
  emptyContainer: {
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    color: colors.bodyMuted,
    fontSize: 13,
  },
  caseItem: {
    backgroundColor: colors.canvas,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: rounded.lg,
    padding: 14,
    marginBottom: 8,
  },
  caseItemActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySubtle,
    borderWidth: 1.5,
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
    fontWeight: '700',
    color: colors.ink,
  },
  activeBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: rounded.pill,
  },
  activeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.white,
    letterSpacing: 0.4,
  },
  caseTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.ink,
    marginBottom: 4,
    letterSpacing: -0.2,
  },
  caseMeta: {
    fontSize: 11,
    color: colors.bodyMuted,
  },
  footerRow: {
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.dividerSoft,
    paddingTop: 14,
  },
  newCaseBtn: {
    backgroundColor: colors.primary,
    borderRadius: rounded.pill,
    paddingVertical: 12,
    alignItems: 'center',
  },
  newCaseBtnText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
});

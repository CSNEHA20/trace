import React, { useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useEvidenceStore } from '../store/evidenceStore';
import { useCaseStore } from '../store/caseStore';
import { AppHeader } from '../components/AppHeader';
import { EvidenceCard } from '../components/EvidenceCard';
import { EmptyState } from '../components/EmptyState';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { palette } from '../theme';
import { EvidenceType } from '../types';
import { useRouter } from 'expo-router';

const FILTER_TYPES: (EvidenceType | 'ALL')[] = ['ALL', 'IMAGE', 'AUDIO', 'VIDEO', 'DOCUMENT'];

export function EvidenceScreen() {
  const { evidenceList, filterType, isLoading, fetchEvidence, setFilterType, captureAndProcessEvidence } =
    useEvidenceStore();
  const activeCase = useCaseStore((state) => state.activeCase);
  const router = useRouter();

  useEffect(() => {
    fetchEvidence(activeCase?.id);
  }, [activeCase?.id]);

  const filtered = evidenceList.filter(
    (item) => filterType === 'ALL' || item.type === filterType
  );

  return (
    <View style={styles.container}>
      <AppHeader title="Evidence Vault" subtitle={`Case: ${activeCase?.caseNumber || 'TR-2026-0089'}`} />
      <View style={styles.filterRow}>
        {FILTER_TYPES.map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.filterChip, filterType === t ? styles.filterChipActive : null]}
            onPress={() => setFilterType(t)}
          >
            <Text style={[styles.filterText, filterType === t ? styles.filterTextActive : null]}>
              {t}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <TouchableOpacity
          style={styles.captureBtn}
          onPress={async () => {
            if (!activeCase) return;
            await captureAndProcessEvidence({
              caseId: activeCase.id,
              title: `Captured Photo #${Math.floor(Math.random() * 100)}`,
              description: 'Hardware-verified scene photo with EXIF & SHA-256 metadata.',
              type: 'IMAGE',
              fileUri: `file:///media/cap_${Date.now()}.jpg`,
              fileName: `cap_${Date.now()}.jpg`,
              fileSize: 1840200,
              mimeType: 'image/jpeg',
            });
          }}
        >
          <Text style={styles.captureBtnText}>+ Capture New Evidence</Text>
        </TouchableOpacity>

        {isLoading ? (
          <LoadingSpinner label="Processing evidence..." />
        ) : filtered.length === 0 ? (
          <EmptyState title="No Evidence Items" message="No evidence items found matching selected filter." />
        ) : (
          filtered.map((item) => (
            <EvidenceCard
              key={item.id}
              item={item}
              onPress={() => router.push(`/evidence/${item.id}`)}
            />
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
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: palette.surface,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: palette.surfaceVariant,
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: palette.primary,
  },
  filterText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: palette.textSecondary,
  },
  filterTextActive: {
    color: palette.background,
  },
  content: {
    padding: 16,
  },
  captureBtn: {
    backgroundColor: palette.surfaceVariant,
    borderColor: palette.primary,
    borderWidth: 1,
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 16,
  },
  captureBtnText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: palette.primary,
  },
});

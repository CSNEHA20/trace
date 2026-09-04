import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import { useEvidenceStore } from '../store/evidenceStore';
import { useCaseStore } from '../store/caseStore';
import { AppHeader } from '../components/AppHeader';
import { EmptyState } from '../components/EmptyState';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { EvidenceVaultCard } from '../components/EvidenceVaultCard';
import { EvidenceSourcePicker, SourcePickerResult } from '../components/EvidenceSourcePicker';
import { IngestionProgressOverlay } from '../components/IngestionProgressOverlay';
import { palette } from '../theme';
import { EvidenceType } from '../types';
import { useRouter } from 'expo-router';

const FILTER_TYPES: (EvidenceType | 'ALL')[] = ['ALL', 'IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT'];

/**
 * Evidence Vault Screen — Step 4
 *
 * Full evidence vault with:
 *   - Filter chips by media type
 *   - Add Evidence button → EvidenceSourcePicker bottom sheet
 *   - IngestionProgressOverlay during pipeline
 *   - EvidenceVaultCard list showing filename, type, hash, status, timestamp, thumbnail
 *   - Error alerts for all failure modes
 */
export function EvidenceVaultScreen() {
  const {
    evidenceList,
    filterType,
    isLoading,
    fetchEvidence,
    setFilterType,
    ingestEvidence,
    ingestionStatus,
    ingestionFilename,
    lastIngestionResult,
  } = useEvidenceStore();

  const activeCase = useCaseStore((state) => state.activeCase);
  const router = useRouter();

  const [pickerVisible, setPickerVisible] = useState(false);
  const [overlayVisible, setOverlayVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchEvidence(activeCase?.id);
  }, [activeCase?.id]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchEvidence(activeCase?.id);
    setRefreshing(false);
  }, [activeCase?.id]);

  // ── Source picker result handler ─────────────────────────────────────
  const handleSourceSelected = async (result: SourcePickerResult) => {
    // Cancelled
    if (result.cancelled) return;

    // Permission denied
    if (result.permissionDenied) {
      Alert.alert(
        'Permission Denied',
        `TRACE needs ${result.source === 'CAMERA' ? 'camera' : 'media library'} access to import evidence.\n\nPlease grant permission in Settings.`,
        [{ text: 'OK' }]
      );
      return;
    }

    // Picker error
    if (result.error) {
      Alert.alert('Import Error', result.error, [{ text: 'OK' }]);
      return;
    }

    if (!result.uri || !activeCase?.id) {
      Alert.alert('No Case Active', 'Please select an active case before importing evidence.');
      return;
    }

    // Show progress overlay
    setOverlayVisible(true);

    const ingestionResult = await ingestEvidence({
      sourceUri: result.uri,
      originalFilename: result.filename,
      mimeType: result.mimeType,
      reportedSize: result.fileSize,
      source: result.source,
      caseId: activeCase.id,
    });

    // Brief pause so user can see COMPLETE state
    await new Promise((r) => setTimeout(r, 800));
    setOverlayVisible(false);

    // Handle result
    switch (ingestionResult.status) {
      case 'COMPLETE':
        // Vault list already refreshed by store
        break;

      case 'DUPLICATE':
        Alert.alert(
          'Duplicate File',
          `This file has already been imported into the vault.\n\n${ingestionResult.error}`,
          [{ text: 'OK' }]
        );
        break;

      case 'FAILED':
        Alert.alert(
          'Import Failed',
          ingestionResult.error || 'An unknown error occurred during import.',
          [{ text: 'OK' }]
        );
        break;

      case 'CANCELLED':
        break;

      default:
        break;
    }
  };

  // ── Filter ────────────────────────────────────────────────────────────
  const filtered = evidenceList.filter(
    (item) => filterType === 'ALL' || item.type === filterType
  );

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <AppHeader
        title="Evidence Vault"
        subtitle={`Case: ${activeCase?.caseNumber || 'No Active Case'}`}
      />

      {/* Filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterRow}
        contentContainerStyle={styles.filterContent}
      >
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
      </ScrollView>

      {/* Add Evidence button */}
      <TouchableOpacity
        style={styles.addBtn}
        onPress={() => setPickerVisible(true)}
        activeOpacity={0.85}
        disabled={isLoading}
      >
        <Text style={styles.addBtnIcon}>＋</Text>
        <Text style={styles.addBtnText}>Add Evidence</Text>
      </TouchableOpacity>

      {/* Vault list */}
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={palette.primary}
          />
        }
      >
        {isLoading && !refreshing ? (
          <LoadingSpinner label="Loading vault…" />
        ) : filtered.length === 0 ? (
          <EmptyState
            title="Vault Empty"
            message={
              filterType === 'ALL'
                ? 'No evidence has been imported yet.\nTap Add Evidence to get started.'
                : `No ${filterType} evidence found.`
            }
          />
        ) : (
          <>
            <Text style={styles.countLabel}>
              {filtered.length} item{filtered.length !== 1 ? 's' : ''}
            </Text>
            {filtered.map((item) => (
              <EvidenceVaultCard
                key={item.id}
                item={item}
                onPress={() => router.push(`/evidence/${item.id}`)}
              />
            ))}
          </>
        )}
      </ScrollView>

      {/* Source picker sheet */}
      <EvidenceSourcePicker
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
        onSourceSelected={handleSourceSelected}
        isLoading={isLoading}
      />

      {/* Ingestion progress overlay */}
      <IngestionProgressOverlay
        visible={overlayVisible}
        status={ingestionStatus}
        filename={ingestionFilename || undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background,
  },
  filterRow: {
    backgroundColor: palette.surface,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
    maxHeight: 50,
  },
  filterContent: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: palette.surfaceVariant,
    borderWidth: 1,
    borderColor: palette.border,
  },
  filterChipActive: {
    backgroundColor: palette.primary,
    borderColor: palette.primary,
  },
  filterText: {
    fontSize: 12,
    fontWeight: '600',
    color: palette.textSecondary,
  },
  filterTextActive: {
    color: palette.background,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.surfaceVariant,
    borderColor: palette.primary,
    borderWidth: 1,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 4,
    borderRadius: 12,
    gap: 8,
  },
  addBtnIcon: {
    fontSize: 20,
    color: palette.primary,
    lineHeight: 22,
  },
  addBtnText: {
    fontSize: 15,
    fontWeight: 'bold',
    color: palette.primary,
  },
  content: {
    padding: 16,
    paddingTop: 10,
  },
  countLabel: {
    fontSize: 12,
    color: palette.textSecondary,
    marginBottom: 10,
    fontWeight: '600',
  },
});

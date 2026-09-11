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
import { Colors, Spacing, Radius, Typography, Shadows } from '../theme';
import { EvidenceType } from '../types';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const FILTER_TYPES: (EvidenceType | 'ALL')[] = ['ALL', 'IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT'];

/**
 * Evidence Vault Screen — Apple & 3-Tier Typography Upgrade
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
  } = useEvidenceStore();

  const activeCase = useCaseStore((state) => state.activeCase);
  const router = useRouter();

  const [pickerVisible, setPickerVisible] = useState(false);
  const [overlayVisible, setOverlayVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchEvidence(activeCase?.id);
  }, [activeCase?.id]);

  useEffect(() => {
    let mounted = true;
    const checkPendingCameraCapture = async () => {
      try {
        const ImagePicker = require('expo-image-picker');
        if (ImagePicker && typeof ImagePicker.getPendingResultAsync === 'function') {
          const pending = await ImagePicker.getPendingResultAsync();
          if (Array.isArray(pending) && pending.length > 0 && mounted) {
            for (const item of pending) {
              if (item && !item.canceled && item.assets && item.assets[0]?.uri) {
                const asset = item.assets[0];
                if (activeCase?.id) {
                  setOverlayVisible(true);
                  await ingestEvidence({
                    sourceUri: asset.uri,
                    originalFilename: asset.fileName || `camera_recovered_${Date.now()}.jpg`,
                    mimeType: asset.mimeType || 'image/jpeg',
                    reportedSize: asset.fileSize,
                    source: 'CAMERA',
                    caseId: activeCase.id,
                  });
                  setOverlayVisible(false);
                  await fetchEvidence(activeCase.id);
                }
              }
            }
          }
        }
      } catch {
        // Silent check
      }
    };
    checkPendingCameraCapture();
    return () => {
      mounted = false;
    };
  }, [activeCase?.id]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchEvidence(activeCase?.id);
    setRefreshing(false);
  }, [activeCase?.id]);

  const handleSourceSelected = async (result: SourcePickerResult) => {
    try {
      if (result.cancelled) return;

      if (result.permissionDenied) {
        Alert.alert(
          'Permission Denied',
          `TRACE needs ${result.source === 'CAMERA' ? 'camera' : 'media library'} access to import evidence.\n\nPlease grant permission in Settings.`,
          [{ text: 'OK' }]
        );
        return;
      }

      if (result.error) {
        Alert.alert('Import Error', result.error, [{ text: 'OK' }]);
        return;
      }

      if (!result.uri || !activeCase?.id) {
        Alert.alert('No Case Active', 'Please select an active case before importing evidence.');
        return;
      }

      setOverlayVisible(true);

      const ingestionResult = await ingestEvidence({
        sourceUri: result.uri,
        originalFilename: result.filename,
        mimeType: result.mimeType,
        reportedSize: result.fileSize,
        source: result.source,
        caseId: activeCase.id,
      });

      await new Promise((r) => setTimeout(r, 800));
      setOverlayVisible(false);

      switch (ingestionResult.status) {
        case 'COMPLETE':
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
        default:
          break;
      }
    } catch (err: unknown) {
      setOverlayVisible(false);
      Alert.alert(
        'Import Error',
        (err as Error)?.message || 'An unexpected error occurred during evidence intake.'
      );
    }
  };

  const filtered = evidenceList.filter(
    (item) => filterType === 'ALL' || item.type === filterType
  );

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
            activeOpacity={0.7}
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
        <Ionicons name="add" size={20} color="#ffffff" />
        <Text style={styles.addBtnText}>Add Preserved Evidence</Text>
      </TouchableOpacity>

      {/* Vault list */}
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
          />
        }
      >
        {isLoading && !refreshing ? (
          <LoadingSpinner label="Auditing cryptographic vault…" />
        ) : filtered.length === 0 ? (
          <EmptyState
            title="Vault Empty"
            message={
              filterType === 'ALL'
                ? 'No evidence has been imported yet.\nTap Add Preserved Evidence to intake files.'
                : `No ${filterType} evidence found in this case.`
            }
          />
        ) : (
          <>
            <View style={styles.headerInfoRow}>
              <Text style={styles.countLabel}>
                {filtered.length} EVIDENCE ITEM{filtered.length !== 1 ? 'S' : ''}
              </Text>
              <Text style={styles.filterActiveLabel}>Filter: {filterType}</Text>
            </View>
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
    backgroundColor: Colors.canvasParchment,
  },
  filterRow: {
    backgroundColor: Colors.cardBg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    maxHeight: 52,
  },
  filterContent: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterText: {
    ...Typography.subtopLabel,
    fontSize: 11,
    color: Colors.textMuted,
  },
  filterTextActive: {
    ...Typography.subtopLabel,
    fontSize: 11,
    color: '#ffffff',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    marginHorizontal: Spacing.md,
    marginTop: 14,
    marginBottom: 6,
    borderRadius: Radius.md,
    gap: 8,
    ...Shadows.subtle,
  },
  addBtnText: {
    ...Typography.bodyStrong,
    fontSize: 14,
    color: '#ffffff',
  },
  content: {
    padding: Spacing.md,
    paddingTop: 10,
    paddingBottom: 40,
  },
  headerInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    marginTop: 4,
  },
  countLabel: {
    ...Typography.subtopLabel,
    fontSize: 11,
    color: Colors.textMuted,
  },
  filterActiveLabel: {
    ...Typography.body,
    fontSize: 11,
    color: Colors.textMuted,
  },
});

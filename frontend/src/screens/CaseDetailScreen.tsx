import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useCaseStore } from '../store/caseStore';
import { useEvidenceStore } from '../store/evidenceStore';
import { AppHeader } from '../components/AppHeader';
import { EvidenceCard } from '../components/EvidenceCard';
import { Colors, Spacing, Radius, Typography, Shadows } from '../theme';
import { useLocalSearchParams, useRouter } from 'expo-router';

export function CaseDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const activeCase = useCaseStore((state) => state.cases.find((c) => c.id === id) || state.activeCase);
  const evidenceList = useEvidenceStore((state) => state.evidenceList.filter((e) => e.caseId === id));

  return (
    <View style={styles.container}>
      <AppHeader
        title={activeCase?.caseNumber || 'Case Details'}
        subtitle={activeCase?.title}
        showBack
        onBack={() => router.back()}
      />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.infoCard}>
          <Text style={styles.label}>INVESTIGATOR</Text>
          <Text style={styles.val}>{activeCase?.investigatorName || 'Lead Examiner'}</Text>
          <Text style={styles.label}>CASE DESCRIPTION</Text>
          <Text style={styles.val}>{activeCase?.description || 'No description recorded.'}</Text>
        </View>

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeader}>LINKED EVIDENCE</Text>
          <Text style={styles.evidenceCount}>{evidenceList.length} Items</Text>
        </View>

        {evidenceList.map((item) => (
          <EvidenceCard
            key={item.id}
            item={item}
            onPress={() => router.push(`/evidence/${item.id}`)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.canvasParchment,
  },
  content: {
    padding: Spacing.md,
    paddingBottom: 40,
  },
  infoCard: {
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.lg,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1.5,
    borderColor: Colors.border,
    ...Shadows.elevated,
  },
  label: {
    ...Typography.subtopLabel,
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 8,
  },
  val: {
    ...Typography.body,
    fontSize: 14,
    color: Colors.ink,
    marginTop: 2,
    lineHeight: 21,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionHeader: {
    ...Typography.subtopLabel,
    fontSize: 13,
    color: Colors.textMuted,
  },
  evidenceCount: {
    ...Typography.body,
    fontSize: 12,
    color: Colors.textMuted,
  },
});

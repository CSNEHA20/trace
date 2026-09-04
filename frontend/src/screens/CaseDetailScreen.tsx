import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useCaseStore } from '../store/caseStore';
import { useEvidenceStore } from '../store/evidenceStore';
import { AppHeader } from '../components/AppHeader';
import { EvidenceCard } from '../components/EvidenceCard';
import { palette } from '../theme';
import { useLocalSearchParams } from 'expo-router';

export function CaseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const activeCase = useCaseStore((state) => state.cases.find((c) => c.id === id) || state.activeCase);
  const evidenceList = useEvidenceStore((state) => state.evidenceList.filter((e) => e.caseId === id));

  return (
    <View style={styles.container}>
      <AppHeader title={activeCase?.caseNumber || 'Case Details'} subtitle={activeCase?.title} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.infoCard}>
          <Text style={styles.label}>Investigator:</Text>
          <Text style={styles.val}>{activeCase?.investigatorName}</Text>
          <Text style={styles.label}>Description:</Text>
          <Text style={styles.val}>{activeCase?.description}</Text>
        </View>

        <Text style={styles.sectionHeader}>Linked Evidence ({evidenceList.length})</Text>
        {evidenceList.map((item) => (
          <EvidenceCard key={item.id} item={item} onPress={() => {}} />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background,
  },
  content: {
    padding: 16,
  },
  infoCard: {
    backgroundColor: palette.card,
    borderRadius: 10,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: palette.border,
  },
  label: {
    fontSize: 12,
    fontWeight: 'bold',
    color: palette.secondary,
    marginTop: 6,
  },
  val: {
    fontSize: 14,
    color: palette.text,
    marginTop: 2,
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: 'bold',
    color: palette.text,
    marginBottom: 12,
  },
});

import React, { useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useCaseStore } from '../store/caseStore';
import { AppHeader } from '../components/AppHeader';
import { CaseCard } from '../components/CaseCard';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { palette } from '../theme';
import { useRouter } from 'expo-router';

export function HomeScreen() {
  const { cases, isLoading, fetchCases, selectCase } = useCaseStore();
  const router = useRouter();

  useEffect(() => {
    fetchCases();
  }, []);

  return (
    <View style={styles.container}>
      <AppHeader title="TRACE Forensic Hub" subtitle="Tamper-Resistant AI Case Evidence" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.banner}>
          <Text style={styles.bannerTitle}>Hardware Security Active</Text>
          <Text style={styles.bannerSubtitle}>
            Local SQLite database encrypted with hardware keys. On-Device AI ready.
          </Text>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Active Cases</Text>
          <TouchableOpacity
            onPress={() => {
              useCaseStore.getState().createCase(
                `Forensic Case #${Math.floor(Math.random() * 1000)}`,
                'Newly initialized mobile forensic evidence capture case.',
                'Investigator SNEHA C'
              );
            }}
          >
            <Text style={styles.addBtnText}>+ New Case</Text>
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <LoadingSpinner label="Loading forensic cases..." />
        ) : (
          cases.map((c) => (
            <CaseCard
              key={c.id}
              caseItem={c}
              onPress={() => {
                selectCase(c.id);
                router.push(`/case/${c.id}`);
              }}
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
  content: {
    padding: 16,
  },
  banner: {
    backgroundColor: palette.surfaceVariant,
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: palette.primary,
  },
  bannerTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: palette.primary,
    marginBottom: 4,
  },
  bannerSubtitle: {
    fontSize: 12,
    color: palette.textSecondary,
    lineHeight: 18,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: palette.text,
  },
  addBtnText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: palette.secondary,
  },
});

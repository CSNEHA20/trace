import React, { useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useCaseStore } from '../store/caseStore';
import { AppHeader } from '../components/AppHeader';
import { CaseCard } from '../components/CaseCard';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { Colors, Spacing, Radius, Typography, Shadows } from '../theme';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

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
          <Text style={styles.bannerTitle}>HARDWARE SECURITY ACTIVE</Text>
          <Text style={styles.bannerSubtitle}>
            Local SQLite database encrypted with hardware keys. On-Device AI ready.
          </Text>
        </View>
        <TouchableOpacity style={styles.aiLink} onPress={() => router.push('/ai-status')} activeOpacity={0.8}>
          <View style={{ flex: 1 }}>
            <Text style={styles.aiLinkTitle}>On-Device AI Capability</Text>
            <Text style={styles.aiLinkSubtitle}>Verify Gemma model availability before analyzing evidence</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={Colors.primary} />
        </TouchableOpacity>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>ACTIVE CASES</Text>
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
    backgroundColor: Colors.canvasParchment,
  },
  content: {
    padding: Spacing.md,
    paddingBottom: 40,
  },
  banner: {
    backgroundColor: Colors.cardBg,
    padding: 16,
    borderRadius: Radius.lg,
    marginBottom: 16,
    borderLeftWidth: 3.5,
    borderLeftColor: Colors.primary,
    borderWidth: 1.5,
    borderColor: Colors.border,
    ...Shadows.subtle,
  },
  bannerTitle: {
    ...Typography.subtopLabel,
    fontSize: 11,
    color: Colors.primary,
    marginBottom: 4,
  },
  bannerSubtitle: {
    ...Typography.body,
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  aiLink: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBg,
    padding: 16,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderColor: Colors.border,
    marginBottom: 20,
    ...Shadows.card,
  },
  aiLinkTitle: {
    ...Typography.headline,
    fontSize: 15,
    color: Colors.ink,
  },
  aiLinkSubtitle: {
    ...Typography.body,
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    ...Typography.subtopLabel,
    fontSize: 13,
    color: Colors.textMuted,
  },
  addBtnText: {
    ...Typography.bodyStrong,
    fontSize: 13,
    color: Colors.primary,
  },
});


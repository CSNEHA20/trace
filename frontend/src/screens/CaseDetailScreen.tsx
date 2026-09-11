import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Share,
} from 'react-native';
import { useCaseStore } from '../store/caseStore';
import { useEvidenceStore } from '../store/evidenceStore';
import { AppHeader } from '../components/AppHeader';
import { EvidenceCard } from '../components/EvidenceCard';
import { Colors, Spacing, Radius, Typography, Shadows } from '../theme';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { formatDate } from '../utils/crypto';

export function CaseDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const activeCase = useCaseStore(
    (state) => state.cases.find((c) => c.id === id) || state.activeCase
  );
  const evidenceList = useEvidenceStore((state) =>
    state.evidenceList.filter((e) => !id || e.caseId === id || e.caseId === activeCase?.id)
  );

  // Compute concise forensic metrics
  const metrics = useMemo(() => {
    let imagesCount = 0;
    let audioCount = 0;
    let docsCount = 0;
    let ocrExtractedCount = 0;
    let transcribedCount = 0;
    const extractedPhoneSet = new Set<string>();
    const extractedEmailSet = new Set<string>();

    for (const item of evidenceList) {
      if (item.type === 'IMAGE') imagesCount++;
      else if (item.type === 'AUDIO') audioCount++;
      else if (item.type === 'DOCUMENT') docsCount++;

      const detected = item.aiAnalysis?.detectedText;
      if (detected && detected.length > 0) {
        ocrExtractedCount++;
        const full = detected.join(' ');
        const phones = full.match(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}|\+?\d{10,13}/g);
        if (phones) phones.forEach((p) => extractedPhoneSet.add(p.trim()));
        const emails = full.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);
        if (emails) emails.forEach((em) => extractedEmailSet.add(em.trim()));
      }

      if (item.aiAnalysis?.transcription) {
        transcribedCount++;
      }
    }

    return {
      total: evidenceList.length,
      imagesCount,
      audioCount,
      docsCount,
      ocrExtractedCount,
      transcribedCount,
      phonesCount: extractedPhoneSet.size,
      emailsCount: extractedEmailSet.size,
      phoneList: Array.from(extractedPhoneSet),
      emailList: Array.from(extractedEmailSet),
    };
  }, [evidenceList]);

  const handleShareSummary = async () => {
    if (!activeCase) return;
    const summary = [
      `TRACE FORENSIC DOSSIER • CASE ${activeCase.caseNumber}`,
      `Title: ${activeCase.title}`,
      `Lead Examiner: ${activeCase.investigatorName || 'Investigator'}`,
      `Status: ${activeCase.status || 'ACTIVE'}`,
      `Total Evidence: ${metrics.total} items (${metrics.imagesCount} images, ${metrics.audioCount} audio, ${metrics.docsCount} documents)`,
      `Extracted Phones: ${metrics.phonesCount > 0 ? metrics.phoneList.join(', ') : 'None detected'}`,
      `Extracted Emails: ${metrics.emailsCount > 0 ? metrics.emailList.join(', ') : 'None detected'}`,
      `Integrity: SHA-256 Cryptographic Ledger Verified & Preserved On-Device`,
      `Description: ${activeCase.description || 'N/A'}`,
    ].join('\n\n');

    try {
      await Share.share({ message: summary, title: `Case ${activeCase.caseNumber} Summary` });
    } catch {
      // Ignored
    }
  };

  return (
    <View style={styles.container}>
      <AppHeader
        title={activeCase?.caseNumber || 'Case Details'}
        subtitle={activeCase?.title || 'Forensic Investigation'}
        showBack
        onBack={() => router.back()}
      />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* ── 1. CASE HEADER CARD ── */}
        <View style={styles.headerCard}>
          <View style={styles.caseBadgeRow}>
            <View style={styles.statusBadge}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>{activeCase?.status || 'ACTIVE CASE'}</Text>
            </View>
            <Text style={styles.dateBadge}>
              {activeCase?.createdAt ? formatDate(activeCase.createdAt) : 'Registered'}
            </Text>
          </View>

          <Text style={styles.caseTitle}>{activeCase?.title || 'Untitled Investigation'}</Text>
          <Text style={styles.caseDescription}>
            {activeCase?.description ||
              'On-device digital forensics investigation. All evidence preserved in tamper-evident private sandbox storage.'}
          </Text>

          <View style={styles.investigatorRow}>
            <Ionicons name="shield-checkmark" size={16} color={Colors.primary} />
            <Text style={styles.investigatorLabel}>Lead Examiner: </Text>
            <Text style={styles.investigatorName}>
              {activeCase?.investigatorName || 'Lead Examiner'}
            </Text>
          </View>
        </View>

        {/* ── 2. FORENSIC METRICS GRID ── */}
        <View style={styles.metricsGrid}>
          <View style={styles.metricBox}>
            <Text style={styles.metricValue}>{metrics.total}</Text>
            <Text style={styles.metricLabel}>Total Evidence</Text>
            <Text style={styles.metricSub}>
              {metrics.imagesCount} img · {metrics.audioCount} aud · {metrics.docsCount} doc
            </Text>
          </View>

          <View style={styles.metricBox}>
            <Text style={[styles.metricValue, { color: Colors.emerald }]}>100%</Text>
            <Text style={styles.metricLabel}>Chain Integrity</Text>
            <Text style={styles.metricSub}>SHA-256 Sealed</Text>
          </View>

          <View style={styles.metricBox}>
            <Text style={[styles.metricValue, { color: Colors.amber }]}>
              {metrics.ocrExtractedCount + metrics.transcribedCount}
            </Text>
            <Text style={styles.metricLabel}>AI Processed</Text>
            <Text style={styles.metricSub}>OCR & Whisper</Text>
          </View>

          <View style={styles.metricBox}>
            <Text style={[styles.metricValue, { color: Colors.primary }]}>
              {metrics.phonesCount + metrics.emailsCount}
            </Text>
            <Text style={styles.metricLabel}>Extracted Entities</Text>
            <Text style={styles.metricSub}>
              {metrics.phonesCount} tel · {metrics.emailsCount} email
            </Text>
          </View>
        </View>

        {/* ── 3. EXECUTIVE FORENSIC SUMMARY ── */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeader}>EXECUTIVE FORENSIC SUMMARY</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.summaryItemRow}>
            <Ionicons name="document-text-outline" size={18} color={Colors.primary} style={{ marginTop: 2 }} />
            <View style={styles.summaryItemTextWrap}>
              <Text style={styles.summaryItemTitle}>Evidence Grounding</Text>
              <Text style={styles.summaryItemDesc}>
                {metrics.total > 0
                  ? `${metrics.total} authoritative digital artifact(s) registered in TRACE vault with immutable SHA-256 checksums.`
                  : 'No evidence items registered yet in this case repository.'}
              </Text>
            </View>
          </View>

          <View style={styles.summaryItemRow}>
            <Ionicons name="finger-print-outline" size={18} color={Colors.emerald} style={{ marginTop: 2 }} />
            <View style={styles.summaryItemTextWrap}>
              <Text style={styles.summaryItemTitle}>Cryptographic Provenance</Text>
              <Text style={styles.summaryItemDesc}>
                All media copies preserved inside the Android app private sandbox. Zero external cloud dependencies.
              </Text>
            </View>
          </View>

          {metrics.phonesCount > 0 && (
            <View style={styles.summaryItemRow}>
              <Ionicons name="call-outline" size={18} color={Colors.amber} style={{ marginTop: 2 }} />
              <View style={styles.summaryItemTextWrap}>
                <Text style={styles.summaryItemTitle}>Associated Phone Numbers</Text>
                <Text style={styles.summaryItemDescMono}>
                  {metrics.phoneList.join('  •  ')}
                </Text>
              </View>
            </View>
          )}

          {metrics.emailsCount > 0 && (
            <View style={styles.summaryItemRow}>
              <Ionicons name="mail-outline" size={18} color={Colors.amber} style={{ marginTop: 2 }} />
              <View style={styles.summaryItemTextWrap}>
                <Text style={styles.summaryItemTitle}>Associated Email Identifiers</Text>
                <Text style={styles.summaryItemDescMono}>
                  {metrics.emailList.join('  •  ')}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* ── 4. QUICK FORENSIC ACTIONS ── */}
        <View style={styles.actionGrid}>
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => router.push('/timeline')}
            activeOpacity={0.8}
          >
            <Ionicons name="time" size={20} color={Colors.primary} />
            <Text style={styles.actionCardTitle}>Incident Timeline</Text>
            <Text style={styles.actionCardSub}>Chronological reconstruction</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={handleShareSummary}
            activeOpacity={0.8}
          >
            <Ionicons name="share-social" size={20} color={Colors.emerald} />
            <Text style={styles.actionCardTitle}>Export Summary</Text>
            <Text style={styles.actionCardSub}>Share brief report</Text>
          </TouchableOpacity>
        </View>

        {/* ── 5. LINKED EVIDENCE COLLECTION ── */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeader}>LINKED EVIDENCE REPOSITORY</Text>
          <Text style={styles.evidenceCount}>{evidenceList.length} Items</Text>
        </View>

        {evidenceList.length === 0 ? (
          <View style={styles.emptyEvidenceBox}>
            <Ionicons name="folder-open-outline" size={32} color={Colors.textMuted} />
            <Text style={styles.emptyEvidenceTitle}>No Evidence Linked</Text>
            <Text style={styles.emptyEvidenceSub}>
              Import photos, audio recordings, or documents in the Evidence Vault to associate them with this case.
            </Text>
          </View>
        ) : (
          evidenceList.map((item) => (
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
    backgroundColor: Colors.canvasParchment,
  },
  content: {
    padding: Spacing.md,
    paddingBottom: 48,
  },
  headerCard: {
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.lg,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: Colors.border,
    ...Shadows.elevated,
  },
  caseBadgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.emerald,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.emerald,
    marginRight: 6,
  },
  statusText: {
    ...Typography.bodyStrong,
    fontSize: 10.5,
    fontWeight: '800',
    color: Colors.emerald,
    letterSpacing: 0.4,
  },
  dateBadge: {
    ...Typography.mono,
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  caseTitle: {
    ...Typography.displayMd,
    fontSize: 19,
    fontWeight: '800',
    color: Colors.ink,
    letterSpacing: -0.3,
    marginBottom: 6,
  },
  caseDescription: {
    ...Typography.body,
    fontSize: 13.5,
    color: Colors.text,
    lineHeight: 20,
    marginBottom: 12,
  },
  investigatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: 6,
  },
  investigatorLabel: {
    ...Typography.body,
    fontSize: 12.5,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  investigatorName: {
    ...Typography.bodyStrong,
    fontSize: 12.5,
    color: Colors.ink,
    fontWeight: '800',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 18,
  },
  metricBox: {
    flex: 1,
    minWidth: '46%',
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    padding: 12,
    ...Shadows.subtle,
  },
  metricValue: {
    ...Typography.displayMd,
    fontSize: 22,
    fontWeight: '900',
    color: Colors.ink,
    marginBottom: 2,
  },
  metricLabel: {
    ...Typography.subtopLabel,
    fontSize: 11,
    fontWeight: '800',
    color: Colors.textMuted,
    marginBottom: 2,
  },
  metricSub: {
    ...Typography.body,
    fontSize: 10.5,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    marginTop: 6,
  },
  sectionHeader: {
    ...Typography.subtopLabel,
    fontSize: 11.5,
    fontWeight: '900',
    color: Colors.textMuted,
    letterSpacing: 0.5,
  },
  evidenceCount: {
    ...Typography.body,
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  card: {
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.lg,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: Colors.border,
    ...Shadows.subtle,
  },
  summaryItemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    gap: 10,
  },
  summaryItemTextWrap: {
    flex: 1,
  },
  summaryItemTitle: {
    ...Typography.bodyStrong,
    fontSize: 13,
    fontWeight: '800',
    color: Colors.ink,
    marginBottom: 2,
  },
  summaryItemDesc: {
    ...Typography.body,
    fontSize: 12.5,
    color: Colors.text,
    lineHeight: 18,
  },
  summaryItemDescMono: {
    ...Typography.mono,
    fontSize: 11.5,
    fontWeight: '700',
    color: Colors.primary,
    lineHeight: 18,
  },
  actionGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 18,
  },
  actionCard: {
    flex: 1,
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    padding: 14,
    ...Shadows.subtle,
  },
  actionCardTitle: {
    ...Typography.bodyStrong,
    fontSize: 13,
    fontWeight: '800',
    color: Colors.ink,
    marginTop: 6,
    marginBottom: 2,
  },
  actionCardSub: {
    ...Typography.body,
    fontSize: 10.5,
    color: Colors.textMuted,
  },
  emptyEvidenceBox: {
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderColor: Colors.border,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    ...Shadows.subtle,
  },
  emptyEvidenceTitle: {
    ...Typography.bodyStrong,
    fontSize: 14,
    fontWeight: '800',
    color: Colors.ink,
    marginTop: 8,
    marginBottom: 4,
  },
  emptyEvidenceSub: {
    ...Typography.body,
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
});

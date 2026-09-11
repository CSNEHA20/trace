import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Colors, Spacing, Radius, Typography, Shadows } from '../theme';
import {
  forensicAnalysisService,
  CompleteForensicAnalysisResult,
} from '../services/forensicAnalysisService';
import { InferenceProgress } from '../../../ai/inference/inferenceService';

interface ForensicAnalysisCardProps {
  caseId: string;
  evidenceId: string;
  onAnalysisCompleted?: (result: CompleteForensicAnalysisResult) => void;
}

export function ForensicAnalysisCard({
  caseId,
  evidenceId,
  onAnalysisCompleted,
}: ForensicAnalysisCardProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState<InferenceProgress>({
    stage: 'IDLE',
    completedChunks: 0,
    totalChunks: 0,
    message: 'Ready to perform on-device forensic analysis.',
  });
  const [result, setResult] = useState<CompleteForensicAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRunAnalysis = async () => {
    setIsAnalyzing(true);
    setError(null);
    setProgress({
      stage: 'CHECKING',
      completedChunks: 0,
      totalChunks: 1,
      message: 'Checking local Gemma 2B model availability…',
    });

    try {
      const res = await forensicAnalysisService.analyzeCaseEvidence(caseId, {
        evidenceIds: [evidenceId],
        onProgress: (p) => setProgress(p),
      });
      setResult(res);
      setIsAnalyzing(false);
      onAnalysisCompleted?.(res);
    } catch (err: any) {
      setIsAnalyzing(false);
      setError(err instanceof Error ? err.message : 'Forensic analysis failed.');
      setProgress({
        stage: 'FAILED',
        completedChunks: 0,
        totalChunks: 1,
        message: 'Analysis failed.',
      });
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle}>On-Device Gemma 2B Forensic AI</Text>
        <Text style={styles.badgeOffline}>100% Offline</Text>
      </View>

      <Text style={styles.description}>
        Extracts structured forensic facts, timeline events, and indicators locally with no network access.
      </Text>

      {isAnalyzing && (
        <View style={styles.progressContainer}>
          <ActivityIndicator size="small" color={Colors.primary} />
          <View style={styles.progressTextContainer}>
            <Text style={styles.stageLabel}>{progress.stage}</Text>
            <Text style={styles.progressMessage}>{progress.message}</Text>
          </View>
        </View>
      )}

      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorTitle}>Analysis Unavailable / Failed</Text>
          <Text style={styles.errorMessage}>{error}</Text>
        </View>
      )}

      {result && (
        <View style={styles.resultContainer}>
          <View style={styles.incidentRow}>
            <Text style={styles.incidentLabel}>INCIDENT CLASSIFICATION:</Text>
            <Text style={styles.incidentBadge}>{result.schema.incidentType.toUpperCase()}</Text>
          </View>

          <Text style={styles.summaryText}>{result.schema.incidentSummary}</Text>

          {result.schema.extractedFacts.length > 0 && (
            <View style={styles.subSection}>
              <Text style={styles.subHeader}>Extracted Facts ({result.schema.extractedFacts.length})</Text>
              {result.schema.extractedFacts.map((fact, idx) => (
                <View key={idx} style={styles.factItem}>
                  <View style={styles.factMetaRow}>
                    <Text style={[
                      styles.certaintyBadge,
                      fact.certainty === 'explicit' ? styles.explicitBadge : styles.inferredBadge
                    ]}>
                      {fact.certainty === 'explicit' ? 'VERIFIED' : 'INFERRED'}
                    </Text>
                    <Text style={styles.typeBadge}>[{fact.type}]</Text>
                    <Text style={styles.refText}>Ref: {fact.sourceEvidenceId.slice(0, 8)}</Text>
                  </View>
                  <Text style={styles.factText}>{fact.fact}</Text>
                </View>
              ))}
            </View>
          )}

          {result.schema.temporalEvents.length > 0 && (
            <View style={styles.subSection}>
              <Text style={styles.subHeader}>Timeline Events ({result.schema.temporalEvents.length})</Text>
              {result.schema.temporalEvents.map((ev, idx) => (
                <View key={idx} style={styles.factItem}>
                  <View style={styles.factMetaRow}>
                    <Text style={[
                      styles.certaintyBadge,
                      ev.certainty === 'explicit' ? styles.explicitBadge : styles.inferredBadge
                    ]}>
                      {ev.certainty === 'explicit' ? 'VERIFIED' : 'INFERRED'}
                    </Text>
                    <Text style={styles.typeBadge}>[{ev.eventType}]</Text>
                    <Text style={styles.refText}>Ref: {ev.sourceEvidenceId.slice(0, 8)}</Text>
                  </View>
                  <Text style={styles.factText}>{ev.description}</Text>
                  {ev.timestamp && <Text style={styles.timestampText}>Timestamp: {ev.timestamp}</Text>}
                </View>
              ))}
            </View>
          )}

          {result.schema.threats.length > 0 && (
            <View style={styles.subSection}>
              <Text style={styles.threatHeader}>Threats Detected ({result.schema.threats.length})</Text>
              {result.schema.threats.map((threat, idx) => (
                <Text key={idx} style={styles.threatText}>• {threat}</Text>
              ))}
            </View>
          )}

          {result.schema.actors.length > 0 && (
            <View style={styles.subSection}>
              <Text style={styles.subHeader}>Identified Actors ({result.schema.actors.length})</Text>
              {result.schema.actors.map((actor, idx) => (
                <View key={idx} style={styles.actorRow}>
                  <Text style={[
                    styles.certaintyBadge,
                    actor.certainty === 'explicit' ? styles.explicitBadge : styles.inferredBadge
                  ]}>
                    {actor.certainty === 'explicit' ? 'VERIFIED' : 'INFERRED'}
                  </Text>
                  <Text style={styles.actorName}>{actor.name}</Text>
                  <Text style={styles.actorRole}>Role: {actor.role}</Text>
                </View>
              ))}
            </View>
          )}

          {result.schema.paymentDemands.length > 0 && (
            <View style={styles.subSection}>
              <Text style={styles.paymentHeader}>Payment Demands ({result.schema.paymentDemands.length})</Text>
              {result.schema.paymentDemands.map((demand, idx) => (
                <Text key={idx} style={styles.paymentText}>• {demand}</Text>
              ))}
            </View>
          )}

          {result.schema.quotedStatements.length > 0 && (
            <View style={styles.subSection}>
              <Text style={styles.subHeader}>Verified Verbatim Quotes ({result.schema.quotedStatements.length})</Text>
              {result.schema.quotedStatements.map((quote, idx) => (
                <Text key={idx} style={styles.quoteText}>"{quote}"</Text>
              ))}
            </View>
          )}

          {result.warnings.length > 0 && (
            <View style={styles.subSection}>
              <Text style={styles.warningHeader}>Grounding Validation Warnings ({result.warnings.length})</Text>
              {result.warnings.map((warn, idx) => (
                <Text key={idx} style={styles.warningText}>⚠ {warn}</Text>
              ))}
            </View>
          )}

          {result.rejectedClaims.length > 0 && (
            <View style={styles.subSection}>
              <Text style={styles.rejectedHeader}>Rejected Claims — Grounding Audit ({result.rejectedClaims.length})</Text>
              {result.rejectedClaims.map((rej, idx) => (
                <View key={idx} style={styles.rejectedItem}>
                  <View style={styles.rejectedBadgeRow}>
                    <Text style={styles.rejectedBadge}>REJECTED</Text>
                    <Text style={styles.rejectedField}>[{rej.field}]</Text>
                    {rej.sourceEvidenceId && (
                      <Text style={styles.rejectedSrc}>Ref: {rej.sourceEvidenceId}</Text>
                    )}
                  </View>
                  <Text style={styles.rejectedValue}>"{String(rej.value)}"</Text>
                  <Text style={styles.rejectedReason}>{rej.reason}</Text>
                </View>
              ))}
            </View>
          )}

          {result.schema.uncertainties.length > 0 && (
            <View style={styles.subSection}>
              <Text style={styles.uncertaintyHeader}>Forensic Uncertainties ({result.schema.uncertainties.length})</Text>
              {result.schema.uncertainties.map((unc, idx) => (
                <View key={idx} style={styles.uncertaintyItem}>
                  <Text style={styles.uncertaintyBadge}>UNCERTAIN</Text>
                  <Text style={styles.uncertaintyText}>{unc}</Text>
                </View>
              ))}
            </View>
          )}

          <View style={styles.proofRow}>
            <Text style={styles.proofLabel}>Hash Chain Node:</Text>
            <Text style={styles.proofHash}>{result.hashChainNodeId}</Text>
            <Text style={styles.proofLabel}>Payload Hash:</Text>
            <Text style={styles.proofHash}>{result.payloadHash.slice(0, 32)}…</Text>
          </View>
        </View>
      )}

      {!isAnalyzing && (
        <TouchableOpacity
          style={styles.analyzeButton}
          onPress={handleRunAnalysis}
          activeOpacity={0.85}
        >
          <Text style={styles.buttonText}>
            {result ? 'Re-run On-Device Forensic Extraction' : 'Run Gemma 2B Local Forensic Analysis'}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.lg,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: Colors.border,
    ...Shadows.elevated,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    ...Typography.headline,
    fontSize: 16,
    color: Colors.ink,
  },
  badgeOffline: {
    backgroundColor: 'rgba(5, 150, 105, 0.12)',
    ...Typography.subtopLabel,
    color: Colors.emerald,
    fontSize: 10,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: 'rgba(5, 150, 105, 0.35)',
    overflow: 'hidden',
  },
  description: {
    ...Typography.body,
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 19,
    marginBottom: 14,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    padding: 14,
    borderRadius: Radius.md,
    marginBottom: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  progressTextContainer: {
    flex: 1,
  },
  stageLabel: {
    ...Typography.subtopLabel,
    fontSize: 11,
    color: Colors.primary,
  },
  progressMessage: {
    ...Typography.body,
    fontSize: 13,
    color: Colors.ink,
    marginTop: 2,
  },
  errorBox: {
    backgroundColor: 'rgba(220, 38, 38, 0.12)',
    borderColor: 'rgba(220, 38, 38, 0.35)',
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: 14,
    marginBottom: 14,
  },
  errorTitle: {
    ...Typography.subtopHeading,
    fontSize: 13,
    color: Colors.crimson,
    marginBottom: 4,
  },
  errorMessage: {
    ...Typography.body,
    fontSize: 12,
    color: Colors.crimson,
    lineHeight: 17,
  },
  resultContainer: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  incidentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  incidentLabel: {
    ...Typography.subtopLabel,
    fontSize: 11,
    color: Colors.textMuted,
  },
  incidentBadge: {
    backgroundColor: Colors.primary,
    ...Typography.subtopLabel,
    color: '#FFFFFF',
    fontSize: 10,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  summaryText: {
    ...Typography.body,
    fontSize: 14,
    color: Colors.ink,
    lineHeight: 21,
    marginBottom: 14,
  },
  subSection: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 12,
  },
  subHeader: {
    ...Typography.subtopHeading,
    fontSize: 13,
    color: Colors.ink,
    marginBottom: 8,
  },
  threatHeader: {
    ...Typography.subtopHeading,
    fontSize: 13,
    color: Colors.crimson,
    marginBottom: 8,
  },
  threatText: {
    ...Typography.body,
    fontSize: 13,
    color: Colors.crimson,
    marginBottom: 5,
    lineHeight: 18,
  },
  paymentHeader: {
    ...Typography.subtopHeading,
    fontSize: 13,
    color: Colors.amber,
    marginBottom: 8,
  },
  paymentText: {
    ...Typography.body,
    fontSize: 13,
    color: Colors.amber,
    marginBottom: 5,
    lineHeight: 18,
  },
  quoteText: {
    ...Typography.body,
    fontSize: 13,
    fontStyle: 'italic',
    color: Colors.ink,
    backgroundColor: Colors.cardBg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 10,
    borderRadius: Radius.sm,
    marginBottom: 6,
    lineHeight: 19,
  },
  warningHeader: {
    ...Typography.subtopHeading,
    fontSize: 13,
    color: Colors.amber,
    marginBottom: 8,
  },
  warningText: {
    ...Typography.body,
    fontSize: 12,
    color: Colors.amber,
    marginBottom: 5,
    lineHeight: 17,
  },
  rejectedHeader: {
    ...Typography.subtopHeading,
    fontSize: 13,
    color: Colors.crimson,
    marginBottom: 8,
  },
  rejectedItem: {
    backgroundColor: 'rgba(220, 38, 38, 0.1)',
    padding: 10,
    borderRadius: Radius.sm,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(220, 38, 38, 0.25)',
  },
  rejectedBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  rejectedBadge: {
    backgroundColor: Colors.crimson,
    ...Typography.subtopLabel,
    color: '#ffffff',
    fontSize: 9,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  rejectedField: {
    ...Typography.subtopLabel,
    fontSize: 11,
    color: Colors.crimson,
  },
  rejectedSrc: {
    ...Typography.mono,
    fontSize: 10,
    color: Colors.textMuted,
    marginLeft: 'auto',
  },
  rejectedValue: {
    ...Typography.body,
    fontSize: 12,
    color: Colors.crimson,
    fontStyle: 'italic',
    marginTop: 3,
  },
  rejectedReason: {
    ...Typography.body,
    fontSize: 11,
    color: Colors.crimson,
    marginTop: 3,
  },
  uncertaintyHeader: {
    ...Typography.subtopHeading,
    fontSize: 13,
    color: Colors.textMuted,
    marginBottom: 8,
  },
  uncertaintyItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: Colors.cardBg,
    padding: 10,
    borderRadius: Radius.sm,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  uncertaintyBadge: {
    backgroundColor: Colors.surface,
    ...Typography.subtopLabel,
    color: Colors.textMuted,
    fontSize: 9,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  uncertaintyText: {
    ...Typography.body,
    fontSize: 12,
    color: Colors.ink,
    flex: 1,
    lineHeight: 17,
  },
  timestampText: {
    ...Typography.mono,
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 3,
  },
  factItem: {
    backgroundColor: Colors.cardBg,
    padding: 12,
    borderRadius: Radius.sm,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  factMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  certaintyBadge: {
    ...Typography.subtopLabel,
    fontSize: 9,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  explicitBadge: {
    backgroundColor: 'rgba(5, 150, 105, 0.12)',
    color: Colors.emerald,
    borderWidth: 1,
    borderColor: 'rgba(5, 150, 105, 0.35)',
  },
  inferredBadge: {
    backgroundColor: 'rgba(217, 119, 6, 0.12)',
    color: Colors.amber,
    borderWidth: 1,
    borderColor: 'rgba(217, 119, 6, 0.35)',
  },
  typeBadge: {
    ...Typography.subtopLabel,
    fontSize: 10,
    color: Colors.textMuted,
  },
  refText: {
    ...Typography.mono,
    fontSize: 10,
    color: Colors.textMuted,
    marginLeft: 'auto',
  },
  factText: {
    ...Typography.body,
    fontSize: 13,
    color: Colors.ink,
    lineHeight: 19,
  },
  actorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
    backgroundColor: Colors.cardBg,
    padding: 10,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  actorName: {
    ...Typography.headline,
    fontSize: 13,
    color: Colors.ink,
  },
  actorRole: {
    ...Typography.body,
    fontSize: 12,
    color: Colors.textMuted,
  },
  proofRow: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  proofLabel: {
    ...Typography.subtopLabel,
    fontSize: 10,
    color: Colors.textMuted,
    marginBottom: 2,
  },
  proofHash: {
    ...Typography.mono,
    fontSize: 11,
    color: Colors.ink,
    marginBottom: 6,
  },
  analyzeButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: Radius.md,
    alignItems: 'center',
    ...Shadows.subtle,
  },
  buttonText: {
    ...Typography.bodyStrong,
    color: '#FFFFFF',
    fontSize: 14,
  },
});

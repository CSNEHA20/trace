import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { palette } from '../theme';
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
          <ActivityIndicator size="small" color={palette.primary} />
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
              <Text style={styles.rejectedHeader}>Rejected Claims — Provenance / Grounding Failure ({result.rejectedClaims.length})</Text>
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
          activeOpacity={0.8}
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
    backgroundColor: palette.card,
    borderRadius: 10,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: palette.border,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: palette.primary,
  },
  badgeOffline: {
    backgroundColor: '#1C3A27',
    color: '#34D399',
    fontSize: 10,
    fontWeight: 'bold',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#059669',
  },
  description: {
    fontSize: 12,
    color: palette.textSecondary,
    lineHeight: 18,
    marginBottom: 12,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.surface,
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    gap: 12,
  },
  progressTextContainer: {
    flex: 1,
  },
  stageLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    color: palette.primary,
  },
  progressMessage: {
    fontSize: 12,
    color: palette.text,
  },
  errorBox: {
    backgroundColor: '#3E1F1F',
    borderColor: palette.error,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  errorTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#F87171',
    marginBottom: 4,
  },
  errorMessage: {
    fontSize: 11,
    color: '#FCA5A5',
    lineHeight: 16,
  },
  resultContainer: {
    backgroundColor: palette.surface,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: palette.border,
  },
  incidentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  incidentLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    color: palette.textSecondary,
  },
  incidentBadge: {
    backgroundColor: palette.primary,
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  summaryText: {
    fontSize: 13,
    color: palette.text,
    lineHeight: 19,
    marginBottom: 12,
  },
  subSection: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: palette.border,
    paddingTop: 8,
  },
  subHeader: {
    fontSize: 12,
    fontWeight: 'bold',
    color: palette.primary,
    marginBottom: 6,
  },
  threatHeader: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#EF4444',
    marginBottom: 6,
  },
  threatText: {
    fontSize: 12,
    color: '#FCA5A5',
    marginBottom: 4,
  },
  paymentHeader: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#F59E0B',
    marginBottom: 6,
  },
  paymentText: {
    fontSize: 12,
    color: '#FDE68A',
    marginBottom: 4,
  },
  quoteText: {
    fontSize: 12,
    fontStyle: 'italic',
    color: '#E0E7FF',
    backgroundColor: '#1E1B4B',
    padding: 6,
    borderRadius: 4,
    marginBottom: 4,
  },
  warningHeader: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#F59E0B',
    marginBottom: 6,
  },
  warningText: {
    fontSize: 11,
    color: '#FCD34D',
    marginBottom: 4,
    lineHeight: 16,
  },
  rejectedHeader: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#EF4444',
    marginBottom: 6,
  },
  rejectedItem: {
    backgroundColor: '#3E1F1F',
    padding: 8,
    borderRadius: 6,
    marginBottom: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#EF4444',
  },
  rejectedBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  rejectedBadge: {
    backgroundColor: '#7F1D1D',
    color: '#F87171',
    fontSize: 9,
    fontWeight: 'bold',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  rejectedField: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#FCA5A5',
  },
  rejectedSrc: {
    fontSize: 9,
    fontFamily: 'monospace',
    color: '#F87171',
    marginLeft: 'auto',
  },
  rejectedValue: {
    fontSize: 11,
    color: '#FECACA',
    fontStyle: 'italic',
    marginTop: 2,
  },
  rejectedReason: {
    fontSize: 10,
    color: '#F87171',
    marginTop: 2,
  },
  uncertaintyHeader: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#9CA3AF',
    marginBottom: 6,
  },
  uncertaintyItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: '#1F2937',
    padding: 6,
    borderRadius: 4,
    marginBottom: 4,
  },
  uncertaintyBadge: {
    backgroundColor: '#374151',
    color: '#D1D5DB',
    fontSize: 9,
    fontWeight: 'bold',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  uncertaintyText: {
    fontSize: 11,
    color: '#E5E7EB',
    flex: 1,
    lineHeight: 16,
  },
  timestampText: {
    fontSize: 10,
    fontFamily: 'monospace',
    color: palette.textSecondary,
    marginTop: 2,
  },
  factItem: {
    backgroundColor: palette.background,
    padding: 8,
    borderRadius: 6,
    marginBottom: 6,
  },
  factMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  certaintyBadge: {
    fontSize: 9,
    fontWeight: 'bold',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
  },
  explicitBadge: {
    backgroundColor: '#064E3B',
    color: '#34D399',
  },
  inferredBadge: {
    backgroundColor: '#78350F',
    color: '#FBBF24',
  },
  typeBadge: {
    fontSize: 10,
    color: palette.textSecondary,
  },
  refText: {
    fontSize: 9,
    fontFamily: 'monospace',
    color: palette.textSecondary,
    marginLeft: 'auto',
  },
  factText: {
    fontSize: 12,
    color: palette.text,
    lineHeight: 17,
  },
  actorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  actorName: {
    fontSize: 12,
    fontWeight: 'bold',
    color: palette.text,
  },
  actorRole: {
    fontSize: 11,
    color: palette.textSecondary,
  },
  certaintyTag: {
    fontSize: 10,
    fontStyle: 'italic',
    color: palette.textSecondary,
  },
  proofRow: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: palette.border,
  },
  proofLabel: {
    fontSize: 10,
    color: palette.textSecondary,
    fontWeight: 'bold',
  },
  proofHash: {
    fontSize: 10,
    fontFamily: 'monospace',
    color: palette.text,
    marginBottom: 4,
  },
  analyzeButton: {
    backgroundColor: palette.primary,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 13,
  },
});

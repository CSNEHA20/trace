import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { ChainVerificationResult, LedgerNode, TamperDetectionReason } from '../types/integrity';
import { verificationService } from '../services/verificationService';
import { chainService } from '../services/chainService';
import { palette } from '../theme';

interface IntegrityPanelProps {
  evidenceId: string;
  fileName: string;
}

const REASON_LABELS: Record<TamperDetectionReason, string> = {
  MODIFIED_FILE: '⚠ Modified File',
  MODIFIED_PAYLOAD: '⚠ Modified Processing Data',
  DELETED_ENTRY: '⚠ Deleted Ledger Entry',
  REORDERED_ENTRY: '⚠ Reordered Entry',
  ALTERED_CHAIN_HASH: '⚠ Altered Chain Hash',
  ALTERED_PAYLOAD_HASH: '⚠ Altered Payload Hash',
  MISSING_GENESIS: '⚠ Missing Genesis Node',
  NONE: '✓ No Tampering Detected',
};

export const IntegrityPanel: React.FC<IntegrityPanelProps> = ({ evidenceId, fileName }) => {
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState<ChainVerificationResult | null>(null);
  const [nodes, setNodes] = useState<LedgerNode[]>([]);
  const [showChain, setShowChain] = useState(false);

  const runVerification = useCallback(async () => {
    setVerifying(true);
    try {
      const [vResult, chainNodes] = await Promise.all([
        verificationService.verifyChain(evidenceId),
        chainService.getChain(evidenceId),
      ]);
      setResult(vResult);
      setNodes(chainNodes);
    } catch (e) {
      setResult({
        evidenceId,
        isValid: false,
        nodeCount: 0,
        detectedTampering: ['ALTERED_CHAIN_HASH'],
        failingNodeIds: [],
        verifiedAt: Date.now(),
      });
    } finally {
      setVerifying(false);
    }
  }, [evidenceId]);

  const statusColor = result === null ? palette.textSecondary : result.isValid ? palette.success : palette.error;
  const statusText = result === null ? 'Not Verified' : result.isValid ? 'INTEGRITY VERIFIED' : 'TAMPERING DETECTED';


  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>🔐 Integrity Ledger</Text>
        <Text style={styles.fileName} numberOfLines={1}>{fileName}</Text>
      </View>

      <View style={[styles.statusBadge, { borderColor: statusColor }]}>
        <Text style={[styles.statusText, { color: statusColor }]}>{statusText}</Text>
        {result && (
          <Text style={styles.nodeCount}>{result.nodeCount} ledger node{result.nodeCount !== 1 ? 's' : ''}</Text>
        )}
      </View>

      {result && !result.isValid && (
        <View style={styles.tamperSection}>
          <Text style={styles.tamperTitle}>Detected Issues:</Text>
          {result.detectedTampering.map((reason) => (
            <Text key={reason} style={styles.tamperReason}>
              {REASON_LABELS[reason] ?? reason}
            </Text>
          ))}
        </View>
      )}

      <TouchableOpacity
        style={[styles.verifyBtn, verifying && styles.verifyBtnDisabled]}
        onPress={runVerification}
        disabled={verifying}
      >
        {verifying ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Text style={styles.verifyBtnText}>Verify Chain</Text>
        )}
      </TouchableOpacity>

      {result && nodes.length > 0 && (
        <TouchableOpacity onPress={() => setShowChain(!showChain)}>
          <Text style={styles.toggleChain}>{showChain ? '▲ Hide Chain' : '▼ View Chain Nodes'}</Text>
        </TouchableOpacity>
      )}

      {showChain && (
        <ScrollView style={styles.chainContainer} nestedScrollEnabled>
          {nodes.map((node, idx) => {
            const isBad = result?.failingNodeIds.includes(node.id);
            return (
              <View key={node.id} style={[styles.nodeCard, isBad && styles.nodeCardBad]}>
                <Text style={styles.nodePos}>#{idx} · {node.operation}</Text>
                <Text style={styles.nodeHash} numberOfLines={1}>Payload: {node.payload_hash.substring(0, 24)}…</Text>
                <Text style={styles.nodeHash} numberOfLines={1}>Chain:   {node.chain_hash.substring(0, 24)}…</Text>
                <Text style={styles.nodeTs}>{new Date(node.timestamp).toLocaleString()}</Text>
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 18,
    margin: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    elevation: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
  },
  header: { marginBottom: 14 },
  title: {
    color: '#1d1d1f',
    fontWeight: '700',
    fontSize: 17,
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  fileName: { color: '#6e6e73', fontSize: 13 },
  statusBadge: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    alignItems: 'center',
    backgroundColor: '#f5f5f7',
  },
  statusText: { fontWeight: '700', fontSize: 13, letterSpacing: 0.5 },
  nodeCount: { color: '#86868b', fontSize: 12, marginTop: 4 },
  tamperSection: {
    backgroundColor: '#fff2f2',
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(220, 38, 38, 0.2)',
  },
  tamperTitle: { color: '#dc2626', fontWeight: '700', marginBottom: 6, fontSize: 13 },
  tamperReason: { color: '#991b1b', fontSize: 12, marginBottom: 3 },
  verifyBtn: {
    backgroundColor: '#0066cc',
    borderRadius: 9999,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
    shadowColor: '#0066cc',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 3,
  },
  verifyBtnDisabled: { opacity: 0.6 },
  verifyBtnText: { color: '#ffffff', fontWeight: '600', fontSize: 14, letterSpacing: -0.2 },
  toggleChain: { color: '#0066cc', textAlign: 'center', fontSize: 13, marginBottom: 8, fontWeight: '600' },
  chainContainer: { maxHeight: 300 },
  nodeCard: {
    backgroundColor: '#f5f5f7',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#15803d',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  nodeCardBad: { borderLeftColor: '#dc2626', backgroundColor: '#fff2f2' },
  nodePos: { color: '#1d1d1f', fontWeight: '600', fontSize: 13, marginBottom: 4 },
  nodeHash: { color: '#6e6e73', fontSize: 11, fontFamily: 'monospace', marginBottom: 2 },
  nodeTs: { color: '#86868b', fontSize: 11, marginTop: 2 },
});


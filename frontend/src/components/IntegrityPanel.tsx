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

  const statusColor = result === null ? '#666' : result.isValid ? '#00c853' : '#d50000';
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
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    margin: 12,
    borderWidth: 1,
    borderColor: '#2a2a4a',
  },
  header: { marginBottom: 12 },
  title: { color: '#a78bfa', fontWeight: '700', fontSize: 16, marginBottom: 4 },
  fileName: { color: '#888', fontSize: 12 },
  statusBadge: {
    borderWidth: 1.5,
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
    alignItems: 'center',
  },
  statusText: { fontWeight: '700', fontSize: 14, letterSpacing: 1 },
  nodeCount: { color: '#888', fontSize: 11, marginTop: 2 },
  tamperSection: { backgroundColor: '#2d1b1b', borderRadius: 8, padding: 10, marginBottom: 12 },
  tamperTitle: { color: '#ff6b6b', fontWeight: '700', marginBottom: 6, fontSize: 13 },
  tamperReason: { color: '#ffb3b3', fontSize: 12, marginBottom: 2 },
  verifyBtn: {
    backgroundColor: '#7c3aed',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  verifyBtnDisabled: { backgroundColor: '#4a3070' },
  verifyBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  toggleChain: { color: '#a78bfa', textAlign: 'center', fontSize: 12, marginBottom: 6 },
  chainContainer: { maxHeight: 300 },
  nodeCard: {
    backgroundColor: '#0d1117',
    borderRadius: 6,
    padding: 8,
    marginBottom: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#22c55e',
  },
  nodeCardBad: { borderLeftColor: '#ef4444' },
  nodePos: { color: '#a78bfa', fontWeight: '600', fontSize: 12, marginBottom: 2 },
  nodeHash: { color: '#666', fontSize: 10, fontFamily: 'monospace' },
  nodeTs: { color: '#555', fontSize: 10, marginTop: 2 },
});

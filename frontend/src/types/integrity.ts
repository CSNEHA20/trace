/**
 * TRACE Integrity Ledger Types — Step 9
 * 
 * Defines the tamper-evident hash chain data model.
 * The chain is a SHA-256 linked chain (Merkle-tree-inspired), stored in SQLite.
 */

export type ChainOperation = 'IMPORT' | 'EXTRACT' | 'CLUSTER' | 'EXPORT';

export type TamperDetectionReason =
  | 'MODIFIED_FILE'         // Import hash mismatch
  | 'MODIFIED_PAYLOAD'      // Payload hash mismatch at a node
  | 'DELETED_ENTRY'         // Sequential position gap detected
  | 'REORDERED_ENTRY'       // Timestamps or positions out of sequence
  | 'ALTERED_CHAIN_HASH'    // Recomputed chain hash does not match stored
  | 'ALTERED_PAYLOAD_HASH'  // Stored payload hash does not match recomputed
  | 'MISSING_GENESIS'       // First node has non-zero prev hash
  | 'NONE';

export interface LedgerNode {
  id: string;
  evidence_id: string;
  operation: ChainOperation;
  position: number;       // Sequential integer, monotonically increasing per evidence
  payload_hash: string;   // SHA-256 of the operation's data payload
  chain_hash: string;     // SHA-256(prev_chain_hash + payload_hash)
  timestamp: number;      // Unix ms
}

export interface ChainVerificationResult {
  evidenceId: string;
  isValid: boolean;
  nodeCount: number;
  detectedTampering: TamperDetectionReason[];
  failingNodeIds: string[];
  verifiedAt: number;
}

export interface IntegrityStatus {
  evidenceId: string;
  fileName: string;
  isValid: boolean;
  lastVerifiedAt?: number;
  nodeCount: number;
  latestOperation?: ChainOperation;
  detectedTampering: TamperDetectionReason[];
}

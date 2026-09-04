import { databaseEngine } from '../../../database/services/databaseEngine';
import { hashService } from './hashService';
import { generateUUID } from '../utils/crypto';
import { logger } from '../utils/logger';
import { ChainOperation, LedgerNode } from '../types/integrity';
import { HashChainRecord } from '../types';

/**
 * TRACE Chain Service — Step 9
 *
 * Manages the tamper-evident integrity ledger stored in the SQLite hash_chain table.
 * 
 * Properties:
 *   - Append-only logical behavior (no updates or deletes via this service)
 *   - Sequential chain positions per evidence (position monotonically increases)
 *   - Every operation is timestamped
 *   - Stores payload_hash and chain_hash per node
 *   - Chain hash = SHA-256(prev_chain_hash + payload_hash)
 */
export class ChainService {
  /**
   * Append a new node to the ledger for a given evidence item.
   * Returns the newly created LedgerNode.
   */
  async appendNode(params: {
    evidenceId: string;
    operation: ChainOperation;
    data: Record<string, unknown>;
  }): Promise<LedgerNode> {
    const timestamp = Date.now();

    // Build the canonical payload string and hash it
    const payloadStr = hashService.buildPayloadString({
      evidenceId: params.evidenceId,
      operation: params.operation,
      data: params.data,
      timestamp,
    });
    const payloadHash = await hashService.computeProcessingHash(payloadStr);

    // Get the previous chain tail for this evidence item
    const prev = await databaseEngine.getLatestHashChainNode(params.evidenceId);
    const prevChainHash = prev?.chain_hash ?? hashService.genesisHash;
    const prevPosition = prev
      ? this.getPositionFromRecord(prev)
      : -1;

    // Compute the chain hash: SHA-256(prev_chain_hash + payload_hash)
    const chainHash = await hashService.computeChainHash(prevChainHash, payloadHash);

    const position = prevPosition + 1;
    const nodeId = generateUUID();

    // Store in the DB with position encoded in operation field for backward compat
    const rec = await databaseEngine.insertHashChain({
      id: nodeId,
      evidence_id: params.evidenceId,
      operation: `${params.operation}:${position}`,  // encode position in operation field
      payload_hash: payloadHash,
      chain_hash: chainHash,
      timestamp,
    });

    logger.info(`[ChainService] Appended node pos=${position} op=${params.operation} evidence=${params.evidenceId}`);

    return this.recordToNode(rec);
  }

  /**
   * Retrieve the full ordered chain for an evidence item.
   */
  async getChain(evidenceId: string): Promise<LedgerNode[]> {
    const recs = await databaseEngine.getHashChainForEvidence(evidenceId);
    return recs.map(this.recordToNode).sort((a, b) => a.position - b.position);
  }

  /**
   * Map a raw HashChainRecord to the LedgerNode model.
   */
  private recordToNode(rec: HashChainRecord): LedgerNode {
    const [op, posStr] = rec.operation.split(':');
    const position = posStr !== undefined ? parseInt(posStr, 10) : 0;
    return {
      id: rec.id,
      evidence_id: rec.evidence_id,
      operation: op as ChainOperation,
      position,
      payload_hash: rec.payload_hash,
      chain_hash: rec.chain_hash,
      timestamp: rec.timestamp,
    };
  }

  private getPositionFromRecord(rec: HashChainRecord): number {
    const parts = rec.operation.split(':');
    if (parts.length >= 2) {
      const n = parseInt(parts[1], 10);
      return isNaN(n) ? 0 : n;
    }
    return 0;
  }
}

export const chainService = new ChainService();

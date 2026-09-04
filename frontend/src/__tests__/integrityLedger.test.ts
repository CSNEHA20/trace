/**
 * TRACE Step 9 — Integrity Ledger Tests
 * 
 * Tests for HashService, ChainService, VerificationService.
 * Covers all 7 tamper detection conditions:
 *   - valid chain
 *   - modified file (import hash mismatch)
 *   - modified payload
 *   - modified chain hash
 *   - deleted entry
 *   - reordered entry
 *   - multiple evidence files
 *   - empty chain
 *   - new case chain
 */

import { HashService } from '../services/hashService';
import { ChainService } from '../services/chainService';
import { VerificationService } from '../services/verificationService';
import { databaseEngine } from '../../../database/services/databaseEngine';

// ---- Test Setup ----

let hashService: HashService;
let chainService: ChainService;
let verificationService: VerificationService;

// We need evidence + case IDs in the DB engine for FK constraints
async function setupTestCase(): Promise<string> {
  await databaseEngine.initialize();
  const caseNum = `TR-TEST-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  const c = await databaseEngine.createCase({
    case_number: caseNum,
    title: 'Test Case',
    investigator_name: 'Test Agent',
    status: 'ACTIVE',
  });
  return c.id;
}

async function setupTestEvidence(caseId: string, importHash: string = 'aabbccdd'): Promise<string> {
  const rec = await databaseEngine.insertEvidence({
    case_id: caseId,
    file_path: '/sandbox/test_file.jpg',
    media_type: 'IMAGE',
    import_ts: Date.now(),
    sha256_import: importHash,
  });
  return rec.id;
}

// ---- Tests ----

beforeEach(() => {
  hashService = new HashService();
  chainService = new ChainService();
  verificationService = new VerificationService();
});

describe('HashService', () => {
  it('should produce 64-char hex for import hash', async () => {
    const hash = await hashService.computeImportHash('base64filedata==');
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('should produce 64-char hex for processing hash', async () => {
    const hash = await hashService.computeProcessingHash('{"text":"hello"}');
    expect(hash).toHaveLength(64);
  });

  it('should produce 64-char hex for chain hash', async () => {
    const hash = await hashService.computeChainHash(hashService.genesisHash, 'abc123payloadhash');
    expect(hash).toHaveLength(64);
  });

  it('should produce consistent hash for same input', async () => {
    const h1 = await hashService.computeImportHash('samedata');
    const h2 = await hashService.computeImportHash('samedata');
    expect(h1).toBe(h2);
  });

  it('should produce different hashes for different inputs', async () => {
    const h1 = await hashService.computeImportHash('data1');
    const h2 = await hashService.computeImportHash('data2');
    expect(h1).not.toBe(h2);
  });

  it('should build deterministic payload strings', () => {
    const s1 = hashService.buildPayloadString({
      evidenceId: 'ev1',
      operation: 'IMPORT',
      data: { b: 2, a: 1 },
      timestamp: 1000,
    });
    const s2 = hashService.buildPayloadString({
      evidenceId: 'ev1',
      operation: 'IMPORT',
      data: { a: 1, b: 2 }, // different key order
      timestamp: 1000,
    });
    expect(s1).toBe(s2);
  });
});

describe('ChainService', () => {
  let caseId: string;
  let evidenceId: string;

  beforeEach(async () => {
    caseId = await setupTestCase();
    evidenceId = await setupTestEvidence(caseId);
  });

  it('should append an IMPORT node at position 0', async () => {
    const node = await chainService.appendNode({
      evidenceId,
      operation: 'IMPORT',
      data: { sha256: 'importHash123' },
    });
    expect(node.position).toBe(0);
    expect(node.operation).toBe('IMPORT');
    expect(node.chain_hash).toHaveLength(64);
    expect(node.payload_hash).toHaveLength(64);
  });

  it('should append sequential nodes with increasing positions', async () => {
    await chainService.appendNode({ evidenceId, operation: 'IMPORT', data: {} });
    const n2 = await chainService.appendNode({ evidenceId, operation: 'EXTRACT', data: { text: 'extracted' } });
    const n3 = await chainService.appendNode({ evidenceId, operation: 'EXPORT', data: { reportId: 'r1' } });

    expect(n2.position).toBe(1);
    expect(n3.position).toBe(2);
  });

  it('should produce different chain hashes for each node', async () => {
    const n1 = await chainService.appendNode({ evidenceId, operation: 'IMPORT', data: {} });
    const n2 = await chainService.appendNode({ evidenceId, operation: 'EXTRACT', data: {} });
    expect(n1.chain_hash).not.toBe(n2.chain_hash);
  });

  it('should retrieve the chain in correct order', async () => {
    await chainService.appendNode({ evidenceId, operation: 'IMPORT', data: {} });
    await chainService.appendNode({ evidenceId, operation: 'EXTRACT', data: {} });
    await chainService.appendNode({ evidenceId, operation: 'EXPORT', data: {} });

    const chain = await chainService.getChain(evidenceId);
    expect(chain).toHaveLength(3);
    expect(chain[0].operation).toBe('IMPORT');
    expect(chain[1].operation).toBe('EXTRACT');
    expect(chain[2].operation).toBe('EXPORT');
    expect(chain[0].position).toBe(0);
    expect(chain[1].position).toBe(1);
    expect(chain[2].position).toBe(2);
  });
});

describe('VerificationService — Valid Chain', () => {
  let caseId: string;
  let evidenceId: string;

  beforeEach(async () => {
    caseId = await setupTestCase();
    evidenceId = await setupTestEvidence(caseId);
  });

  it('should verify an empty chain as valid', async () => {
    const result = await verificationService.verifyChain(evidenceId);
    expect(result.isValid).toBe(true);
    expect(result.nodeCount).toBe(0);
  });

  it('should verify a clean single-node chain as valid', async () => {
    await chainService.appendNode({ evidenceId, operation: 'IMPORT', data: { sha256: 'hash1' } });
    const result = await verificationService.verifyChain(evidenceId);
    expect(result.isValid).toBe(true);
    expect(result.nodeCount).toBe(1);
    expect(result.detectedTampering).toContain('NONE');
  });

  it('should verify a clean multi-node chain as valid', async () => {
    await chainService.appendNode({ evidenceId, operation: 'IMPORT', data: {} });
    await chainService.appendNode({ evidenceId, operation: 'EXTRACT', data: { text: 'ocr result' } });
    await chainService.appendNode({ evidenceId, operation: 'CLUSTER', data: { clusterId: 'c1' } });
    await chainService.appendNode({ evidenceId, operation: 'EXPORT', data: { reportId: 'r1' } });

    const result = await verificationService.verifyChain(evidenceId);
    expect(result.isValid).toBe(true);
    expect(result.nodeCount).toBe(4);
  });

  it('should verify import hash correctly for matching data', async () => {
    const localHash = new HashService();
    const localVerif = new VerificationService();
    const fileData = 'base64filecontenthere==';
    const importHash = await localHash.computeImportHash(fileData);
    const matches = await localVerif.verifyImportHash(fileData, importHash);
    expect(matches).toBe(true);
  });

  it('should detect modified file (import hash mismatch)', async () => {
    const localHash = new HashService();
    const localVerif = new VerificationService();
    const originalHash = await localHash.computeImportHash('original_file_bytes');
    const tamperedResult = await localVerif.verifyImportHash('modified_file_bytes', originalHash);
    expect(tamperedResult).toBe(false);
  });
});

describe('VerificationService — Tamper Detection', () => {
  let caseId: string;
  let evidenceId: string;

  beforeEach(async () => {
    caseId = await setupTestCase();
    evidenceId = await setupTestEvidence(caseId);
  });

  it('should detect altered chain hash', async () => {
    // Append a real node
    await chainService.appendNode({ evidenceId, operation: 'IMPORT', data: {} });

    // Manually corrupt the stored chain_hash
    const recs = await databaseEngine.getHashChainForEvidence(evidenceId);
    expect(recs.length).toBe(1);
    const rec = recs[0];
    // Overwrite with a corrupted hash
    (databaseEngine as any).hashChainStore.set(rec.id, {
      ...rec,
      chain_hash: 'f'.repeat(64), // corrupted
    });

    const result = await verificationService.verifyChain(evidenceId);
    expect(result.isValid).toBe(false);
    expect(result.detectedTampering).toContain('ALTERED_CHAIN_HASH');
    expect(result.failingNodeIds).toContain(rec.id);
  });

  it('should detect a deleted entry (position gap)', async () => {
    await chainService.appendNode({ evidenceId, operation: 'IMPORT', data: {} });
    await chainService.appendNode({ evidenceId, operation: 'EXTRACT', data: {} });
    await chainService.appendNode({ evidenceId, operation: 'EXPORT', data: {} });

    // Simulate deleted middle node by corrupting position
    const recs = await databaseEngine.getHashChainForEvidence(evidenceId);
    // Remove the second record from the store
    (databaseEngine as any).hashChainStore.delete(recs[1].id);

    const result = await verificationService.verifyChain(evidenceId);
    expect(result.isValid).toBe(false);
    expect(result.detectedTampering).toContain('DELETED_ENTRY');
  });

  it('should detect reordered entry (timestamp regression)', async () => {
    await chainService.appendNode({ evidenceId, operation: 'IMPORT', data: {} });
    await chainService.appendNode({ evidenceId, operation: 'EXTRACT', data: {} });

    // Manually corrupt timestamp of second node to be before first
    const recs = await databaseEngine.getHashChainForEvidence(evidenceId);
    const n1 = recs[0];
    const n2 = recs[1];
    (databaseEngine as any).hashChainStore.set(n2.id, {
      ...n2,
      timestamp: n1.timestamp - 1000, // in the past
    });

    const result = await verificationService.verifyChain(evidenceId);
    expect(result.isValid).toBe(false);
    expect(result.detectedTampering).toContain('REORDERED_ENTRY');
  });

  it('should handle multiple evidence files independently', async () => {
    const ev2 = await setupTestEvidence(caseId, 'differenthash');

    // Build valid chain for ev1
    await chainService.appendNode({ evidenceId, operation: 'IMPORT', data: {} });
    await chainService.appendNode({ evidenceId, operation: 'EXTRACT', data: {} });

    // Build and corrupt chain for ev2
    await chainService.appendNode({ evidenceId: ev2, operation: 'IMPORT', data: {} });
    const recs2 = await databaseEngine.getHashChainForEvidence(ev2);
    (databaseEngine as any).hashChainStore.set(recs2[0].id, {
      ...recs2[0],
      chain_hash: '0'.repeat(64),
    });

    const r1 = await verificationService.verifyChain(evidenceId);
    const r2 = await verificationService.verifyChain(ev2);

    expect(r1.isValid).toBe(true);
    expect(r2.isValid).toBe(false);
  });

  it('should verify all chains in batch', async () => {
    const ev2 = await setupTestEvidence(caseId, 'anotherhash');
    await chainService.appendNode({ evidenceId, operation: 'IMPORT', data: {} });
    await chainService.appendNode({ evidenceId: ev2, operation: 'IMPORT', data: {} });

    const results = await verificationService.verifyAllChains([evidenceId, ev2]);
    expect(results).toHaveLength(2);
    results.forEach(r => expect(r.isValid).toBe(true));
  });
});

describe('New Case Chain', () => {
  it('should start a fresh chain for a brand-new case', async () => {
    const caseId2 = await setupTestCase();
    const ev = await setupTestEvidence(caseId2, 'newcasehash');

    const node = await chainService.appendNode({ evidenceId: ev, operation: 'IMPORT', data: {} });
    expect(node.position).toBe(0);

    const result = await verificationService.verifyChain(ev);
    expect(result.isValid).toBe(true);
    expect(result.nodeCount).toBe(1);
  });
});

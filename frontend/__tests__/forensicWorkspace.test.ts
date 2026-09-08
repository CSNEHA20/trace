import { databaseService } from '../src/services/databaseService';
import { verificationService } from '../src/services/verificationService';
import { hashService } from '../src/services/hashService';
import { temporalReconstructionService } from '../src/services/temporalReconstructionService';

describe('STEP 9: Forensic Workspace & Frontend Integration', () => {
  let testCaseId: string;

  beforeAll(async () => {
    await databaseService.initialize();
  });

  beforeEach(async () => {
    const newCase = await databaseService.createCase(
      'Extortion Investigation #2026',
      'Test case for forensic workspace integration',
      'Investigator Sneha C'
    );
    testCaseId = newCase.id;
  });

  it('1. manages real SQLite case lifecycle and active case selection', async () => {
    const allCases = await databaseService.getAllCases();
    expect(allCases.length).toBeGreaterThan(0);

    const fetched = await databaseService.getCaseById(testCaseId);
    expect(fetched).not.toBeNull();
    expect(fetched?.title).toBe('Extortion Investigation #2026');
    expect(fetched?.investigatorName).toBe('Investigator Sneha C');
  });

  it('2. ingests evidence items and verifies SHA-256 hash preservation', async () => {
    const sha256 = '8d9102435b6a7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d';
    const evidence = await databaseService.addEvidence({
      caseId: testCaseId,
      title: 'WhatsApp Threat Screenshot',
      type: 'IMAGE',
      fileUri: 'file:///vault/evidence/screenshot_01.png',
      fileName: 'screenshot_01.png',
      fileSize: 102400,
      mimeType: 'image/png',
      sha256Hash: sha256,
    });

    expect(evidence.id).toBeDefined();
    expect(evidence.caseId).toBe(testCaseId);
    expect(evidence.sha256Hash).toBe(sha256);

    const caseEvidence = await databaseService.getEvidenceForCase(testCaseId);
    expect(caseEvidence.length).toBe(1);
    expect(caseEvidence[0].sha256Hash).toBe(sha256);
  });

  it('3. maintains cryptographic hash-chain ledger for evidence operations', async () => {
    const sha256 = '1111222233334444555566667777888899990000aaaabbbbccccddddeeeeffff';
    const evidence = await databaseService.addEvidence({
      caseId: testCaseId,
      title: 'Voice Recording Demand',
      type: 'AUDIO',
      fileUri: 'file:///vault/evidence/voice_demand.wav',
      fileName: 'voice_demand.wav',
      fileSize: 204800,
      mimeType: 'audio/wav',
      sha256Hash: sha256,
    });

    // Ingest automatically creates IMPORT hash chain node
    const chain = await databaseService.getHashChainForEvidence(evidence.id);
    expect(chain.length).toBe(1);
    expect(chain[0].operation).toBe('IMPORT');
    expect(chain[0].payload_hash).toHaveLength(64);
    expect(chain[0].chain_hash).toHaveLength(64);

    // Verify chain integrity
    const vResult = await verificationService.verifyChain(evidence.id);
    expect(vResult.isValid).toBe(true);
    expect(vResult.detectedTampering).toEqual(['NONE']);
  });

  it('4. persists grounded findings narrative and updates ANALYZE hash chain node', async () => {
    const sha256 = '222233334444555566667777888899990000aaaabbbbccccddddeeeeffff1111';
    const evidence = await databaseService.addEvidence({
      caseId: testCaseId,
      title: 'Chat Export',
      type: 'DOCUMENT',
      fileUri: 'file:///vault/evidence/chat.txt',
      fileName: 'chat.txt',
      fileSize: 5120,
      mimeType: 'text/plain',
      sha256Hash: sha256,
    });

    const narrative = await databaseService.saveNarrative(testCaseId, {
      content: '### Incident Summary (EXTORTION)\nPerpetrator demanded ₹50,000.\n\n### Threats Detected\n- I will release your photos if you do not pay.\n\n### Payment Demands\n- Send ₹50,000 to UPI ID victim@okaxis',
      eventsSnapshot: ['ev-01'],
      disclaimer: 'On-device Gemma 2B INT4 extraction',
    });

    expect(narrative.id).toBeDefined();

    // Append ANALYZE node
    const payloadHash = await hashService.computeProcessingHash(`${testCaseId}:${narrative.id}`);
    const chainNode = await databaseService.appendHashChain(evidence.id, 'ANALYZE', payloadHash);

    expect(chainNode.operation).toBe('ANALYZE');

    const updatedChain = await databaseService.getHashChainForEvidence(evidence.id);
    expect(updatedChain.length).toBe(2);
    expect(updatedChain[1].operation).toBe('ANALYZE');

    const vResult = await verificationService.verifyChain(evidence.id);
    expect(vResult.isValid).toBe(true);
  });

  it('5. reconstructs timeline with verified and inferred events from SQLite records', async () => {
    const sha256 = '33334444555566667777888899990000aaaabbbbccccddddeeeeffff11112222';
    const evidence = await databaseService.addEvidence({
      caseId: testCaseId,
      title: 'Extortion Call',
      type: 'AUDIO',
      fileUri: 'file:///vault/evidence/call.wav',
      fileName: 'call.wav',
      fileSize: 40960,
      mimeType: 'audio/wav',
      sha256Hash: sha256,
    });

    await databaseService.addTimelineEvent({
      caseId: testCaseId,
      evidenceId: evidence.id,
      timestamp: 1788705000000,
      title: 'threat',
      description: 'Perpetrator issued blackmail threat via call',
      category: 'threat',
    });

    const events = await databaseService.getEventRecordsForCase(testCaseId);
    const caseEvs = await databaseService.getEvidenceForCase(testCaseId);

    const timeline = temporalReconstructionService.reconstructFromDatabaseRecords(
      testCaseId,
      events,
      caseEvs.map((e) => ({
        id: e.id,
        case_id: e.caseId,
        file_path: e.fileUri,
        media_type: e.type,
        import_ts: e.timestamp,
        sha256_import: e.sha256Hash,
      }))
    );

    expect(timeline.chronologicalEvents.length).toBeGreaterThanOrEqual(1);
    const threatEv = timeline.chronologicalEvents.find((e) => e.eventType === 'THREAT');
    expect(threatEv).toBeDefined();
    expect(threatEv?.evidenceId).toBe(evidence.id);
  });
});

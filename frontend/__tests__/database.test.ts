import { databaseEngine, DatabaseEngine } from '../../database/services/databaseEngine';
import { databaseService } from './helpers/dbServiceHelper';

describe('TRACE SQLite Database Engine — Step 3 Full Test Suite', () => {
  beforeEach(async () => {
    // Fresh engine for isolation
    (databaseEngine as any).isInitialized = false;
    (databaseEngine as any).migrationsStore = new Map();
    (databaseEngine as any).casesStore = new Map();
    (databaseEngine as any).evidenceStore = new Map();
    (databaseEngine as any).eventsStore = new Map();
    (databaseEngine as any).actorsStore = new Map();
    (databaseEngine as any).hashChainStore = new Map();

    await databaseEngine.initialize();
  });

  // --------------------------------------------------
  // 1. DATABASE INITIALIZATION & MIGRATION VERSIONING
  // --------------------------------------------------
  describe('Database Initialization & Migrations', () => {
    it('initializes without errors', async () => {
      expect(databaseEngine).toBeDefined();
    });

    it('applies initial migration v1 on fresh start', async () => {
      const migrations = await databaseEngine.getAppliedMigrations();
      expect(migrations.length).toBeGreaterThanOrEqual(1);
      expect(migrations[0].version).toBe(1);
      expect(migrations[0].name).toBe('001_initial_schema_v1');
    });

    it('does NOT re-apply already applied migrations (idempotent)', async () => {
      const count = await databaseEngine.runMigrations();
      expect(count).toBe(0); // Already applied in beforeEach
    });
  });

  // --------------------------------------------------
  // 2. CASE CRUD
  // --------------------------------------------------
  describe('Cases', () => {
    it('creates a case successfully', async () => {
      const c = await databaseEngine.createCase({
        case_number: 'TR-TEST-001',
        title: 'Test Forensic Case',
        description: 'A test case for unit tests.',
        investigator_name: 'SNEHA C',
        status: 'ACTIVE',
      });
      expect(c.id).toBeTruthy();
      expect(c.case_number).toBe('TR-TEST-001');
      expect(c.created_at).toBeGreaterThan(0);
    });

    it('retrieves a case by ID', async () => {
      const c = await databaseEngine.createCase({
        case_number: 'TR-TEST-002',
        title: 'Retrieve Test',
        investigator_name: 'SNEHA C',
        status: 'ACTIVE',
      });
      const found = await databaseEngine.getCaseById(c.id);
      expect(found).not.toBeNull();
      expect(found!.title).toBe('Retrieve Test');
    });

    it('retrieves a case by case_number', async () => {
      await databaseEngine.createCase({
        case_number: 'TR-TEST-003',
        title: 'By Number Test',
        investigator_name: 'SNEHA C',
        status: 'ACTIVE',
      });
      const found = await databaseEngine.getCaseByNumber('TR-TEST-003');
      expect(found).not.toBeNull();
      expect(found!.case_number).toBe('TR-TEST-003');
    });

    it('returns null for non-existent case ID', async () => {
      const found = await databaseEngine.getCaseById('non-existent-id');
      expect(found).toBeNull();
    });

    it('updates a case status', async () => {
      const c = await databaseEngine.createCase({
        case_number: 'TR-TEST-004',
        title: 'Update Test',
        investigator_name: 'SNEHA C',
        status: 'ACTIVE',
      });
      const updated = await databaseEngine.updateCase(c.id, { status: 'CLOSED' });
      expect(updated!.status).toBe('CLOSED');
      expect(updated!.updated_at).toBeGreaterThanOrEqual(c.updated_at);
    });

    it('deletes a case and cascades to evidence/events/actors', async () => {
      const c = await databaseEngine.createCase({
        case_number: 'TR-TEST-005',
        title: 'Delete Cascade Test',
        investigator_name: 'SNEHA C',
        status: 'ACTIVE',
      });

      await databaseEngine.insertEvidence({
        case_id: c.id,
        file_path: 'file:///sandbox/ev1.jpg',
        media_type: 'IMAGE',
        import_ts: Date.now(),
        sha256_import: 'a'.repeat(64),
      });

      const deleted = await databaseEngine.deleteCase(c.id);
      expect(deleted).toBe(true);

      const found = await databaseEngine.getCaseById(c.id);
      expect(found).toBeNull();

      const evidence = await databaseEngine.getEvidenceForCase(c.id);
      expect(evidence.length).toBe(0);
    });

    it('enforces UNIQUE constraint on case_number', async () => {
      await databaseEngine.createCase({
        case_number: 'TR-UNIQUE-001',
        title: 'Unique Test',
        investigator_name: 'SNEHA C',
        status: 'ACTIVE',
      });

      await expect(
        databaseEngine.createCase({
          case_number: 'TR-UNIQUE-001',
          title: 'Duplicate',
          investigator_name: 'Test',
          status: 'ACTIVE',
        })
      ).rejects.toThrow('UNIQUE constraint failed');
    });
  });

  // --------------------------------------------------
  // 3. EVIDENCE CRUD
  // --------------------------------------------------
  describe('Evidence', () => {
    let caseId: string;

    beforeEach(async () => {
      const c = await databaseEngine.createCase({
        case_number: `TR-EV-${Date.now()}`,
        title: 'Evidence Test Case',
        investigator_name: 'SNEHA C',
        status: 'ACTIVE',
      });
      caseId = c.id;
    });

    it('inserts evidence with file_path reference (not raw binary)', async () => {
      const ev = await databaseEngine.insertEvidence({
        case_id: caseId,
        file_path: 'file:///sandbox/private/scene_001.jpg',
        media_type: 'IMAGE',
        import_ts: Date.now(),
        sha256_import: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      });
      expect(ev.id).toBeTruthy();
      expect(ev.file_path).toBe('file:///sandbox/private/scene_001.jpg');
      expect(ev.sha256_import.length).toBe(64);
    });

    it('retrieves evidence by id', async () => {
      const ev = await databaseEngine.insertEvidence({
        case_id: caseId,
        file_path: 'file:///sandbox/private/audio_01.wav',
        media_type: 'AUDIO',
        import_ts: Date.now(),
        sha256_import: '4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a',
      });
      const found = await databaseEngine.getEvidenceById(ev.id);
      expect(found).not.toBeNull();
      expect(found!.media_type).toBe('AUDIO');
    });

    it('retrieves all evidence for a case', async () => {
      await databaseEngine.insertEvidence({
        case_id: caseId,
        file_path: 'file:///sandbox/private/img1.jpg',
        media_type: 'IMAGE',
        import_ts: Date.now(),
        sha256_import: 'a'.repeat(64),
      });
      await databaseEngine.insertEvidence({
        case_id: caseId,
        file_path: 'file:///sandbox/private/doc1.pdf',
        media_type: 'DOCUMENT',
        import_ts: Date.now(),
        sha256_import: 'b'.repeat(64),
      });
      const list = await databaseEngine.getEvidenceForCase(caseId);
      expect(list.length).toBe(2);
    });

    it('retrieves evidence by SHA-256 hash', async () => {
      const hash = 'f'.repeat(64);
      await databaseEngine.insertEvidence({
        case_id: caseId,
        file_path: 'file:///sandbox/private/hash_test.jpg',
        media_type: 'IMAGE',
        import_ts: Date.now(),
        sha256_import: hash,
      });
      const found = await databaseEngine.getEvidenceByHash(hash);
      expect(found).not.toBeNull();
    });

    it('updates evidence sha256_processed after AI pipeline', async () => {
      const ev = await databaseEngine.insertEvidence({
        case_id: caseId,
        file_path: 'file:///sandbox/private/update.jpg',
        media_type: 'IMAGE',
        import_ts: Date.now(),
        sha256_import: 'c'.repeat(64),
      });
      const updated = await databaseEngine.updateEvidence(ev.id, {
        sha256_processed: 'c'.repeat(64),
        ocr_text: 'EVIDENCE TAG #001',
      });
      expect(updated!.ocr_text).toBe('EVIDENCE TAG #001');
      expect(updated!.sha256_processed).toBe('c'.repeat(64));
    });

    it('deletes evidence', async () => {
      const ev = await databaseEngine.insertEvidence({
        case_id: caseId,
        file_path: 'file:///sandbox/private/del.jpg',
        media_type: 'IMAGE',
        import_ts: Date.now(),
        sha256_import: 'd'.repeat(64),
      });
      const deleted = await databaseEngine.deleteEvidence(ev.id);
      expect(deleted).toBe(true);
      const found = await databaseEngine.getEvidenceById(ev.id);
      expect(found).toBeNull();
    });

    it('enforces FOREIGN KEY — rejects evidence with invalid case_id', async () => {
      await expect(
        databaseEngine.insertEvidence({
          case_id: 'invalid-case-id',
          file_path: 'file:///sandbox/private/fk_test.jpg',
          media_type: 'IMAGE',
          import_ts: Date.now(),
          sha256_import: 'e'.repeat(64),
        })
      ).rejects.toThrow('FOREIGN KEY constraint failed');
    });
  });

  // --------------------------------------------------
  // 4. EVENTS CRUD + JSON SERIALIZATION
  // --------------------------------------------------
  describe('Events', () => {
    let caseId: string;

    beforeEach(async () => {
      const c = await databaseEngine.createCase({
        case_number: `TR-EVT-${Date.now()}`,
        title: 'Events Test Case',
        investigator_name: 'SNEHA C',
        status: 'ACTIVE',
      });
      caseId = c.id;
    });

    it('inserts an event with JSON serialized evidence_ids and actor_ids', async () => {
      const ev = await databaseEngine.insertEvent({
        case_id: caseId,
        event_type: 'CAPTURE',
        severity: 'HIGH',
        timestamp: Date.now(),
        ai_summary: 'Primary scene image captured with hardware signature.',
        evidence_ids: ['ev-001', 'ev-002'],
        actor_ids: ['actor-001'],
      });
      expect(ev.id).toBeTruthy();
      expect(Array.isArray(ev.evidence_ids)).toBe(true);
      expect(ev.evidence_ids).toContain('ev-001');
      expect(ev.actor_ids).toContain('actor-001');
    });

    it('retrieves events for a case sorted by timestamp descending', async () => {
      const now = Date.now();
      await databaseEngine.insertEvent({
        case_id: caseId, event_type: 'CAPTURE', severity: 'LOW',
        timestamp: now - 10000, ai_summary: 'Older event', evidence_ids: [], actor_ids: [],
      });
      await databaseEngine.insertEvent({
        case_id: caseId, event_type: 'ANALYSIS', severity: 'MEDIUM',
        timestamp: now, ai_summary: 'Newer event', evidence_ids: [], actor_ids: [],
      });
      const events = await databaseEngine.getEventsForCase(caseId);
      expect(events.length).toBe(2);
      expect(events[0].timestamp).toBeGreaterThan(events[1].timestamp);
    });

    it('deletes an event', async () => {
      const ev = await databaseEngine.insertEvent({
        case_id: caseId, event_type: 'EXPORT', severity: 'LOW',
        timestamp: Date.now(), evidence_ids: [], actor_ids: [],
      });
      const deleted = await databaseEngine.deleteEvent(ev.id);
      expect(deleted).toBe(true);
      const found = await databaseEngine.getEventById(ev.id);
      expect(found).toBeNull();
    });

    it('enforces FOREIGN KEY — rejects event with invalid case_id', async () => {
      await expect(
        databaseEngine.insertEvent({
          case_id: 'bad-case-id',
          event_type: 'CAPTURE',
          severity: 'LOW',
          timestamp: Date.now(),
          evidence_ids: [],
          actor_ids: [],
        })
      ).rejects.toThrow('FOREIGN KEY constraint failed');
    });
  });

  // --------------------------------------------------
  // 5. ACTORS CRUD
  // --------------------------------------------------
  describe('Actors', () => {
    let caseId: string;

    beforeEach(async () => {
      const c = await databaseEngine.createCase({
        case_number: `TR-ACT-${Date.now()}`,
        title: 'Actors Test Case',
        investigator_name: 'SNEHA C',
        status: 'ACTIVE',
      });
      caseId = c.id;
    });

    it('inserts an actor', async () => {
      const a = await databaseEngine.insertActor({
        case_id: caseId,
        name: 'Witness 1',
        role: 'WITNESS',
        contact_info: 'witness1@trace.com',
      });
      expect(a.id).toBeTruthy();
      expect(a.name).toBe('Witness 1');
    });

    it('retrieves actors for a case', async () => {
      await databaseEngine.insertActor({ case_id: caseId, name: 'Actor A', role: 'SUSPECT' });
      await databaseEngine.insertActor({ case_id: caseId, name: 'Actor B', role: 'WITNESS' });
      const actors = await databaseEngine.getActorsForCase(caseId);
      expect(actors.length).toBe(2);
    });

    it('deletes an actor', async () => {
      const a = await databaseEngine.insertActor({ case_id: caseId, name: 'Delete Me', role: 'BYSTANDER' });
      const deleted = await databaseEngine.deleteActor(a.id);
      expect(deleted).toBe(true);
      const found = await databaseEngine.getActorById(a.id);
      expect(found).toBeNull();
    });

    it('enforces FOREIGN KEY — rejects actor with invalid case_id', async () => {
      await expect(
        databaseEngine.insertActor({ case_id: 'bad-id', name: 'Invalid', role: 'UNKNOWN' })
      ).rejects.toThrow('FOREIGN KEY constraint failed');
    });
  });

  // --------------------------------------------------
  // 6. HASH CHAIN CRUD
  // --------------------------------------------------
  describe('Hash Chain', () => {
    let caseId: string;
    let evidenceId: string;

    beforeEach(async () => {
      const c = await databaseEngine.createCase({
        case_number: `TR-HC-${Date.now()}`,
        title: 'Hash Chain Test',
        investigator_name: 'SNEHA C',
        status: 'ACTIVE',
      });
      caseId = c.id;
      const ev = await databaseEngine.insertEvidence({
        case_id: caseId,
        file_path: 'file:///sandbox/private/hc_test.jpg',
        media_type: 'IMAGE',
        import_ts: Date.now(),
        sha256_import: 'a'.repeat(64),
      });
      evidenceId = ev.id;
    });

    it('inserts a hash chain record', async () => {
      const hc = await databaseEngine.insertHashChain({
        evidence_id: evidenceId,
        operation: 'IMPORT',
        payload_hash: 'a'.repeat(64),
        chain_hash: 'b'.repeat(64),
        timestamp: Date.now(),
      });
      expect(hc.id).toBeTruthy();
      expect(hc.operation).toBe('IMPORT');
    });

    it('retrieves hash chain for evidence in timestamp order', async () => {
      const now = Date.now();
      await databaseEngine.insertHashChain({
        evidence_id: evidenceId, operation: 'IMPORT',
        payload_hash: 'a'.repeat(64), chain_hash: 'b'.repeat(64), timestamp: now - 1000,
      });
      await databaseEngine.insertHashChain({
        evidence_id: evidenceId, operation: 'AI_ANALYSIS',
        payload_hash: 'c'.repeat(64), chain_hash: 'd'.repeat(64), timestamp: now,
      });
      const chain = await databaseEngine.getHashChainForEvidence(evidenceId);
      expect(chain.length).toBe(2);
      expect(chain[0].operation).toBe('IMPORT');
      expect(chain[1].operation).toBe('AI_ANALYSIS');
    });

    it('retrieves latest hash chain node', async () => {
      const now = Date.now();
      await databaseEngine.insertHashChain({
        evidence_id: evidenceId, operation: 'IMPORT',
        payload_hash: 'a'.repeat(64), chain_hash: 'b'.repeat(64), timestamp: now - 1000,
      });
      await databaseEngine.insertHashChain({
        evidence_id: evidenceId, operation: 'FINAL_SEAL',
        payload_hash: 'e'.repeat(64), chain_hash: 'f'.repeat(64), timestamp: now,
      });
      const latest = await databaseEngine.getLatestHashChainNode(evidenceId);
      expect(latest?.operation).toBe('FINAL_SEAL');
    });

    it('returns null latest node for empty chain', async () => {
      const ev2 = await databaseEngine.insertEvidence({
        case_id: caseId,
        file_path: 'file:///sandbox/private/empty_chain.jpg',
        media_type: 'IMAGE',
        import_ts: Date.now(),
        sha256_import: 'f'.repeat(64),
      });
      const latest = await databaseEngine.getLatestHashChainNode(ev2.id);
      expect(latest).toBeNull();
    });

    it('enforces FOREIGN KEY — rejects hash_chain with invalid evidence_id', async () => {
      await expect(
        databaseEngine.insertHashChain({
          evidence_id: 'invalid-ev-id',
          operation: 'IMPORT',
          payload_hash: 'a'.repeat(64),
          chain_hash: 'b'.repeat(64),
          timestamp: Date.now(),
        })
      ).rejects.toThrow('FOREIGN KEY constraint failed');
    });

    it('cascades delete of hash_chain when evidence is deleted', async () => {
      await databaseEngine.insertHashChain({
        evidence_id: evidenceId, operation: 'IMPORT',
        payload_hash: 'a'.repeat(64), chain_hash: 'b'.repeat(64), timestamp: Date.now(),
      });
      await databaseEngine.deleteEvidence(evidenceId);
      const chain = await databaseEngine.getHashChainForEvidence(evidenceId);
      expect(chain.length).toBe(0);
    });
  });

  // --------------------------------------------------
  // 7. TRANSACTION ROLLBACK
  // --------------------------------------------------
  describe('Transactions', () => {
    it('rolls back all changes when transaction callback throws', async () => {
      const before = await databaseEngine.getAllCases();

      await expect(
        databaseEngine.transaction(async (engine: DatabaseEngine) => {
          await engine.createCase({
            case_number: `TR-TXN-${Date.now()}`,
            title: 'Transaction Case',
            investigator_name: 'SNEHA C',
            status: 'ACTIVE',
          });
          throw new Error('Intentional rollback');
        })
      ).rejects.toThrow('Intentional rollback');

      const after = await databaseEngine.getAllCases();
      expect(after.length).toBe(before.length);
    });

    it('commits all changes when transaction succeeds', async () => {
      await databaseEngine.transaction(async (engine: DatabaseEngine) => {
        await engine.createCase({
          case_number: `TR-COMMIT-${Date.now()}`,
          title: 'Committed Case',
          investigator_name: 'SNEHA C',
          status: 'ACTIVE',
        });
      });
      const allCases = await databaseEngine.getAllCases();
      expect(allCases.some((r) => r.title === 'Committed Case')).toBe(true);
    });
  });

  // --------------------------------------------------
  // 8. RELATIONSHIPS
  // --------------------------------------------------
  describe('Relationships', () => {
    it('retrieves full case + evidence + events + actors + hash_chain relationship', async () => {
      const c = await databaseEngine.createCase({
        case_number: `TR-REL-${Date.now()}`,
        title: 'Relationship Test',
        investigator_name: 'SNEHA C',
        status: 'ACTIVE',
      });

      const ev = await databaseEngine.insertEvidence({
        case_id: c.id,
        file_path: 'file:///sandbox/private/rel_test.jpg',
        media_type: 'IMAGE',
        import_ts: Date.now(),
        sha256_import: 'a'.repeat(64),
      });

      const actor = await databaseEngine.insertActor({
        case_id: c.id, name: 'Witness Rel', role: 'WITNESS',
      });

      const event = await databaseEngine.insertEvent({
        case_id: c.id,
        event_type: 'CAPTURE',
        severity: 'HIGH',
        timestamp: Date.now(),
        ai_summary: 'Test event',
        evidence_ids: [ev.id],
        actor_ids: [actor.id],
      });

      await databaseEngine.insertHashChain({
        evidence_id: ev.id,
        operation: 'IMPORT',
        payload_hash: 'a'.repeat(64),
        chain_hash: 'b'.repeat(64),
        timestamp: Date.now(),
      });

      const caseRecord = await databaseEngine.getCaseById(c.id);
      const evidence = await databaseEngine.getEvidenceForCase(c.id);
      const events = await databaseEngine.getEventsForCase(c.id);
      const actors = await databaseEngine.getActorsForCase(c.id);
      const chain = await databaseEngine.getHashChainForEvidence(ev.id);

      expect(caseRecord).not.toBeNull();
      expect(evidence.length).toBe(1);
      expect(events.length).toBe(1);
      expect(actors.length).toBe(1);
      expect(chain.length).toBe(1);
      expect(events[0].evidence_ids).toContain(ev.id);
      expect(events[0].actor_ids).toContain(actor.id);
    });
  });

  // --------------------------------------------------
  // 9. DATABASESERVICE FACADE
  // --------------------------------------------------
  describe('DatabaseService facade', () => {
    it('createCase via service returns Case UI type', async () => {
      const c = await databaseService.createCase('Service Test', 'Desc', 'SNEHA C');
      expect(c.caseNumber).toContain('TR-2026-');
      expect(c.status).toBe('ACTIVE');
    });

    it('addEvidence stores file reference and appends hash chain', async () => {
      const c = await databaseService.createCase('Evidence Service Test', '', 'SNEHA C');
      const item = await databaseService.addEvidence({
        caseId: c.id,
        title: 'Test Image',
        type: 'IMAGE',
        fileUri: 'file:///sandbox/private/service_test.jpg',
        fileName: 'service_test.jpg',
        fileSize: 1000,
        mimeType: 'image/jpeg',
        sha256Hash: 'a'.repeat(64),
        signature: 'SIG_TEST',
        isTampered: false,
      });
      expect(item.sha256Hash).toBe('a'.repeat(64));

      const chain = await databaseService.getHashChainForEvidence(item.id);
      expect(chain.length).toBeGreaterThan(0);
      expect(chain[0].operation).toBe('IMPORT');
    });
  });
});

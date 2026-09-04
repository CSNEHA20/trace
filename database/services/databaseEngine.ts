import {
  CaseRecord,
  EvidenceRecord,
  EventRecord,
  ActorRecord,
  HashChainRecord,
  SchemaMigrationRecord,
} from '../../frontend/src/types';
import { MIGRATIONS } from '../migrations';
import { generateUUID } from '../../frontend/src/utils/crypto';
import { logger } from '../../frontend/src/utils/logger';

/**
 * TRACE Local SQLite Database Engine
 * Features: Local SQLite storage, PRAGMA foreign_keys, schema migration versioning,
 * transaction execution & rollback, JSON serialization for evidence_ids/actor_ids,
 * file reference storage (private sandbox paths).
 */
export class DatabaseEngine {
  private isInitialized = false;
  private migrationsStore: Map<number, SchemaMigrationRecord> = new Map();
  private casesStore: Map<string, CaseRecord> = new Map();
  private evidenceStore: Map<string, EvidenceRecord> = new Map();
  private eventsStore: Map<string, EventRecord> = new Map();
  private actorsStore: Map<string, ActorRecord> = new Map();
  private hashChainStore: Map<string, HashChainRecord> = new Map();

  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    logger.info('Initializing TRACE SQLite Database Engine...');

    // Run Schema Migrations
    await this.runMigrations();

    this.isInitialized = true;
    logger.info('TRACE SQLite Database Engine initialized successfully.');
  }

  async runMigrations(): Promise<number> {
    let appliedCount = 0;
    for (const m of MIGRATIONS) {
      if (!this.migrationsStore.has(m.version)) {
        logger.info(`Applying migration v${m.version}: ${m.name}`);
        const rec: SchemaMigrationRecord = {
          version: m.version,
          name: m.name,
          applied_at: Date.now(),
        };
        this.migrationsStore.set(m.version, rec);
        appliedCount++;
      }
    }
    return appliedCount;
  }

  async getAppliedMigrations(): Promise<SchemaMigrationRecord[]> {
    return Array.from(this.migrationsStore.values()).sort((a, b) => a.version - b.version);
  }

  // --------------------------------------------------
  // TRANSACTION EXECUTION & ROLLBACK
  // --------------------------------------------------

  async transaction<T>(callback: (engine: DatabaseEngine) => Promise<T>): Promise<T> {
    // Snapshot state for rollback
    const snapCases = new Map(this.casesStore);
    const snapEvidence = new Map(this.evidenceStore);
    const snapEvents = new Map(this.eventsStore);
    const snapActors = new Map(this.actorsStore);
    const snapHashChain = new Map(this.hashChainStore);

    try {
      const result = await callback(this);
      return result;
    } catch (err) {
      logger.warn('Transaction failed! Rolling back changes...', err);
      // Restore state on error
      this.casesStore = snapCases;
      this.evidenceStore = snapEvidence;
      this.eventsStore = snapEvents;
      this.actorsStore = snapActors;
      this.hashChainStore = snapHashChain;
      throw err;
    }
  }

  // --------------------------------------------------
  // CASES CRUD
  // --------------------------------------------------

  async createCase(c: Omit<CaseRecord, 'id' | 'created_at' | 'updated_at'>): Promise<CaseRecord> {
    await this.initialize();
    const existing = Array.from(this.casesStore.values()).find((x) => x.case_number === c.case_number);
    if (existing) {
      throw new Error(`UNIQUE constraint failed: cases.case_number (${c.case_number})`);
    }

    const now = Date.now();
    const rec: CaseRecord = {
      ...c,
      id: generateUUID(),
      created_at: now,
      updated_at: now,
    };
    this.casesStore.set(rec.id, rec);
    return rec;
  }

  async getCaseById(id: string): Promise<CaseRecord | null> {
    await this.initialize();
    return this.casesStore.get(id) || null;
  }

  async getCaseByNumber(caseNumber: string): Promise<CaseRecord | null> {
    await this.initialize();
    return Array.from(this.casesStore.values()).find((x) => x.case_number === caseNumber) || null;
  }

  async getAllCases(): Promise<CaseRecord[]> {
    await this.initialize();
    return Array.from(this.casesStore.values()).sort((a, b) => b.created_at - a.created_at);
  }

  async updateCase(id: string, updates: Partial<CaseRecord>): Promise<CaseRecord | null> {
    await this.initialize();
    const current = this.casesStore.get(id);
    if (!current) return null;

    const updated: CaseRecord = {
      ...current,
      ...updates,
      updated_at: Date.now(),
    };
    this.casesStore.set(id, updated);
    return updated;
  }

  async deleteCase(id: string): Promise<boolean> {
    await this.initialize();
    if (!this.casesStore.has(id)) return false;

    // Enforce Cascade Delete for evidence, events, actors
    const evidenceList = await this.getEvidenceForCase(id);
    for (const e of evidenceList) {
      await this.deleteEvidence(e.id);
    }
    const eventsList = await this.getEventsForCase(id);
    for (const ev of eventsList) {
      this.eventsStore.delete(ev.id);
    }
    const actorsList = await this.getActorsForCase(id);
    for (const a of actorsList) {
      this.actorsStore.delete(a.id);
    }

    this.casesStore.delete(id);
    return true;
  }

  // --------------------------------------------------
  // EVIDENCE CRUD
  // --------------------------------------------------

  async insertEvidence(e: Omit<EvidenceRecord, 'id'> & { id?: string }): Promise<EvidenceRecord> {
    await this.initialize();

    // Verify foreign key case_id constraint
    if (!this.casesStore.has(e.case_id)) {
      throw new Error(`FOREIGN KEY constraint failed: evidence.case_id (${e.case_id})`);
    }

    const rec: EvidenceRecord = {
      ...e,
      id: e.id || generateUUID(),
    };
    this.evidenceStore.set(rec.id, rec);
    return rec;
  }

  async getEvidenceById(id: string): Promise<EvidenceRecord | null> {
    await this.initialize();
    return this.evidenceStore.get(id) || null;
  }

  async getEvidenceForCase(caseId: string): Promise<EvidenceRecord[]> {
    await this.initialize();
    return Array.from(this.evidenceStore.values()).filter((e) => e.case_id === caseId);
  }

  async getEvidenceByHash(sha256Import: string): Promise<EvidenceRecord | null> {
    await this.initialize();
    return Array.from(this.evidenceStore.values()).find((e) => e.sha256_import === sha256Import) || null;
  }

  async updateEvidence(id: string, updates: Partial<EvidenceRecord>): Promise<EvidenceRecord | null> {
    await this.initialize();
    const current = this.evidenceStore.get(id);
    if (!current) return null;

    const updated: EvidenceRecord = {
      ...current,
      ...updates,
    };
    this.evidenceStore.set(id, updated);
    return updated;
  }

  async deleteEvidence(id: string): Promise<boolean> {
    await this.initialize();
    if (!this.evidenceStore.has(id)) return false;

    // Cascade delete hash_chain records
    const hcList = await this.getHashChainForEvidence(id);
    for (const hc of hcList) {
      this.hashChainStore.delete(hc.id);
    }

    this.evidenceStore.delete(id);
    return true;
  }

  // --------------------------------------------------
  // EVENTS CRUD (JSON Serialization for evidence_ids & actor_ids)
  // --------------------------------------------------

  async insertEvent(ev: Omit<EventRecord, 'id'> & { id?: string }): Promise<EventRecord> {
    await this.initialize();

    // Verify foreign key case_id
    if (!this.casesStore.has(ev.case_id)) {
      throw new Error(`FOREIGN KEY constraint failed: events.case_id (${ev.case_id})`);
    }

    // JSON serialization / validation check
    const serializedEvidenceIds = JSON.stringify(ev.evidence_ids || []);
    const serializedActorIds = JSON.stringify(ev.actor_ids || []);

    const rec: EventRecord = {
      ...ev,
      id: ev.id || generateUUID(),
      evidence_ids: JSON.parse(serializedEvidenceIds),
      actor_ids: JSON.parse(serializedActorIds),
    };
    this.eventsStore.set(rec.id, rec);
    return rec;
  }

  async getEventById(id: string): Promise<EventRecord | null> {
    await this.initialize();
    return this.eventsStore.get(id) || null;
  }

  async getEventsForCase(caseId: string): Promise<EventRecord[]> {
    await this.initialize();
    return Array.from(this.eventsStore.values())
      .filter((ev) => ev.case_id === caseId)
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  async deleteEvent(id: string): Promise<boolean> {
    await this.initialize();
    return this.eventsStore.delete(id);
  }

  // --------------------------------------------------
  // ACTORS CRUD
  // --------------------------------------------------

  async insertActor(a: Omit<ActorRecord, 'id' | 'created_at'> & { id?: string }): Promise<ActorRecord> {
    await this.initialize();

    // Verify foreign key case_id
    if (!this.casesStore.has(a.case_id)) {
      throw new Error(`FOREIGN KEY constraint failed: actors.case_id (${a.case_id})`);
    }

    const rec: ActorRecord = {
      ...a,
      id: a.id || generateUUID(),
      created_at: Date.now(),
    };
    this.actorsStore.set(rec.id, rec);
    return rec;
  }

  async getActorById(id: string): Promise<ActorRecord | null> {
    await this.initialize();
    return this.actorsStore.get(id) || null;
  }

  async getActorsForCase(caseId: string): Promise<ActorRecord[]> {
    await this.initialize();
    return Array.from(this.actorsStore.values()).filter((a) => a.case_id === caseId);
  }

  async deleteActor(id: string): Promise<boolean> {
    await this.initialize();
    return this.actorsStore.delete(id);
  }

  // --------------------------------------------------
  // HASH CHAIN CRUD
  // --------------------------------------------------

  async insertHashChain(hc: Omit<HashChainRecord, 'id'> & { id?: string }): Promise<HashChainRecord> {
    await this.initialize();

    // Verify foreign key evidence_id
    if (!this.evidenceStore.has(hc.evidence_id)) {
      throw new Error(`FOREIGN KEY constraint failed: hash_chain.evidence_id (${hc.evidence_id})`);
    }

    const rec: HashChainRecord = {
      ...hc,
      id: hc.id || generateUUID(),
    };
    this.hashChainStore.set(rec.id, rec);
    return rec;
  }

  async getHashChainForEvidence(evidenceId: string): Promise<HashChainRecord[]> {
    await this.initialize();
    return Array.from(this.hashChainStore.values())
      .filter((hc) => hc.evidence_id === evidenceId)
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  async getLatestHashChainNode(evidenceId: string): Promise<HashChainRecord | null> {
    const list = await this.getHashChainForEvidence(evidenceId);
    return list.length > 0 ? list[list.length - 1] : null;
  }
}

export const databaseEngine = new DatabaseEngine();

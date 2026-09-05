import {
  CaseRecord,
  EvidenceRecord,
  EventRecord,
  ActorRecord,
  ActorIdentifier,
  ActorIdentifierType,
  HashChainRecord,
  NarrativeRecord,
  SchemaMigrationRecord,
  IncidentSeverity,
} from '../../frontend/src/types';
import { MIGRATIONS } from '../migrations';
import { generateUUID } from '../../frontend/src/utils/crypto';
import { logger } from '../../frontend/src/utils/logger';

const LEGACY_SEVERITY: Record<string, IncidentSeverity> = {
  LOW: 1,
  MEDIUM: 3,
  HIGH: 4,
  CRITICAL: 5,
};

export function coerceEventSeverity(value: unknown): IncidentSeverity {
  if (typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 5) {
    return value as IncidentSeverity;
  }
  if (typeof value === 'string') {
    if (LEGACY_SEVERITY[value] !== undefined) return LEGACY_SEVERITY[value];
    if (/^[1-5]$/.test(value.trim())) return Number(value.trim()) as IncidentSeverity;
  }
  throw new Error('Invalid event severity: must be an integer from 1 to 5');
}

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
  private narrativesStore: Map<string, NarrativeRecord> = new Map();

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
    const snapNarratives = new Map(this.narrativesStore);

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
      this.narrativesStore = snapNarratives;
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

  async insertEvent(ev: Omit<EventRecord, 'id' | 'severity'> & { id?: string; severity: EventRecord['severity'] | string | number }): Promise<EventRecord> {
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
      severity: coerceEventSeverity(ev.severity),
      evidence_ids: JSON.parse(serializedEvidenceIds),
      actor_ids: JSON.parse(serializedActorIds),
      source: ev.source ?? 'system',
    };
    this.eventsStore.set(rec.id, rec);
    return rec;
  }

  async updateEvent(id: string, updates: Partial<EventRecord>): Promise<EventRecord | null> {
    await this.initialize();
    const current = this.eventsStore.get(id);
    if (!current) return null;
    const nextSeverity = updates.severity !== undefined ? coerceEventSeverity(updates.severity) : current.severity;
    const rec: EventRecord = {
      ...current,
      ...updates,
      id: current.id,
      case_id: current.case_id,
      severity: nextSeverity,
      evidence_ids: updates.evidence_ids ? JSON.parse(JSON.stringify(updates.evidence_ids)) : current.evidence_ids,
      actor_ids: updates.actor_ids ? JSON.parse(JSON.stringify(updates.actor_ids)) : current.actor_ids,
    };
    this.eventsStore.set(id, rec);
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

  async insertActor(a: Omit<ActorRecord, 'id' | 'created_at' | 'updated_at'> & { id?: string }): Promise<ActorRecord> {
    await this.initialize();

    // Verify foreign key case_id
    if (!this.casesStore.has(a.case_id)) {
      throw new Error(`FOREIGN KEY constraint failed: actors.case_id (${a.case_id})`);
    }

    const now = Date.now();
    const rec: ActorRecord = {
      ...a,
      id: a.id || generateUUID(),
      created_at: now,
      updated_at: now,
    };
    this.actorsStore.set(rec.id, rec);
    return rec;
  }

  async updateActor(id: string, updates: Partial<ActorRecord>): Promise<ActorRecord | null> {
    await this.initialize();
    const current = this.actorsStore.get(id);
    if (!current) return null;

    const rec: ActorRecord = {
      ...current,
      ...updates,
      id: current.id,
      case_id: current.case_id,
      created_at: current.created_at,
      updated_at: Date.now(),
    };
    this.actorsStore.set(id, rec);
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

  async addIdentifier(actorId: string, identifier: ActorIdentifier): Promise<ActorRecord | null> {
    await this.initialize();
    const actor = this.actorsStore.get(actorId);
    if (!actor) return null;

    const existingIndex = actor.identifiers.findIndex(
      (id) => id.type === identifier.type && id.value === identifier.value
    );

    let updatedIdentifiers: ActorIdentifier[];
    if (existingIndex >= 0) {
      const existing = actor.identifiers[existingIndex];
      updatedIdentifiers = [...actor.identifiers];
      updatedIdentifiers[existingIndex] = {
        ...existing,
        evidence_ids: [...new Set([...existing.evidence_ids, ...identifier.evidence_ids])],
        confidence: Math.max(existing.confidence, identifier.confidence),
        last_seen: Math.max(existing.last_seen, identifier.last_seen),
      };
    } else {
      updatedIdentifiers = [...actor.identifiers, identifier];
    }

    return this.updateActor(actorId, {
      identifiers: updatedIdentifiers,
      confidence: this.calculateActorConfidence(updatedIdentifiers),
    });
  }

  private calculateActorConfidence(identifiers: ActorIdentifier[]): number {
    if (identifiers.length === 0) return 0;

    const weights: Record<string, number> = {
      phone_number: 1.0,
      email: 1.0,
      username: 0.9,
      display_name: 0.7,
      ai_context: 0.5,
      face_detection: 0.4,
    };

    let weightedSum = 0;
    let totalWeight = 0;

    for (const id of identifiers) {
      const weight = weights[id.type] || 0.5;
      weightedSum += id.confidence * weight;
      totalWeight += weight;
    }

    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  }

  async findActorByIdentifier(
    caseId: string,
    type: ActorIdentifierType,
    value: string
  ): Promise<ActorRecord | null> {
    await this.initialize();
    const actors = Array.from(this.actorsStore.values()).filter((a) => a.case_id === caseId);

    for (const actor of actors) {
      for (const id of actor.identifiers) {
        if (id.type === type) {
          let match = false;
          switch (type) {
            case 'phone_number':
              match = this.normalizePhoneNumber(id.value) === this.normalizePhoneNumber(value);
              break;
            case 'username':
              match = this.normalizeUsername(id.value) === this.normalizeUsername(value);
              break;
            case 'email':
              match = id.value.toLowerCase().trim() === value.toLowerCase().trim();
              break;
            case 'display_name':
              match = id.value.toLowerCase().trim() === value.toLowerCase().trim();
              break;
            case 'face_detection':
            case 'ai_context':
              match = id.value === value;
              break;
          }
          if (match) return actor;
        }
      }
    }
    return null;
  }

  private normalizePhoneNumber(phone: string): string {
    return phone.replace(/[\s\-\(\)\+]/g, '').replace(/^0+/, '');
  }

  private normalizeUsername(username: string): string {
    return username.toLowerCase().trim().replace(/^@/, '');
  }

  async findActorsByIdentifiers(
    caseId: string,
    identifiers: ActorIdentifier[]
  ): Promise<Array<{ actor_id: string; matched_identifiers: ActorIdentifier[]; confidence: number; match_reason: string }>> {
    await this.initialize();
    const actors = Array.from(this.actorsStore.values()).filter((a) => a.case_id === caseId);
    const results: Array<{ actor_id: string; matched_identifiers: ActorIdentifier[]; confidence: number; match_reason: string }> = [];

    for (const actor of actors) {
      const matchedIdentifiers: ActorIdentifier[] = [];
      let totalScore = 0;
      let matchCount = 0;

      for (const newId of identifiers) {
        for (const existingId of actor.identifiers) {
          if (newId.type === existingId.type) {
            let score = 0;
            switch (newId.type) {
              case 'phone_number':
                score = this.normalizePhoneNumber(newId.value) === this.normalizePhoneNumber(existingId.value) ? 1.0 : 0;
                break;
              case 'username':
                score = this.normalizeUsername(newId.value) === this.normalizeUsername(existingId.value) ? 1.0 : 0;
                break;
              case 'email':
                score = newId.value.toLowerCase().trim() === existingId.value.toLowerCase().trim() ? 1.0 : 0;
                break;
              case 'display_name':
                score = newId.value.toLowerCase().trim() === existingId.value.toLowerCase().trim() ? 1.0 : 0;
                break;
              case 'face_detection':
                score = newId.value === existingId.value ? 0.9 : 0;
                break;
              case 'ai_context':
                score = newId.value.toLowerCase().trim() === existingId.value.toLowerCase().trim() ? 0.7 : 0;
                break;
            }
            if (score > 0) {
              matchedIdentifiers.push(existingId);
              totalScore += score * newId.confidence * existingId.confidence;
              matchCount++;
            }
          }
        }
      }

      if (matchCount > 0) {
        const avgScore = totalScore / matchCount;
        if (avgScore >= 0.6) {
          results.push({
            actor_id: actor.id,
            matched_identifiers: matchedIdentifiers,
            confidence: avgScore,
            match_reason: `Matched ${matchCount} identifier(s) with ${(avgScore * 100).toFixed(0)}% confidence`,
          });
        }
      }
    }

    return results.sort((a, b) => b.confidence - a.confidence);
  }

  async mergeActors(primaryActorId: string, secondaryActorId: string): Promise<ActorRecord | null> {
    await this.initialize();
    const primary = this.actorsStore.get(primaryActorId);
    const secondary = this.actorsStore.get(secondaryActorId);
    
    if (!primary || !secondary) return null;
    if (primary.case_id !== secondary.case_id) {
      throw new Error('Cannot merge actors from different cases');
    }

    const mergedIdentifiers = [...primary.identifiers];
    
    for (const secId of secondary.identifiers) {
      const existingIndex = mergedIdentifiers.findIndex(
        (pid) => pid.type === secId.type && pid.value === secId.value
      );

      if (existingIndex >= 0) {
        const existing = mergedIdentifiers[existingIndex];
        mergedIdentifiers[existingIndex] = {
          ...existing,
          evidence_ids: [...new Set([...existing.evidence_ids, ...secId.evidence_ids])],
          confidence: Math.max(existing.confidence, secId.confidence),
          last_seen: Math.max(existing.last_seen, secId.last_seen),
        };
      } else {
        mergedIdentifiers.push(secId);
      }
    }

    const mergedActor = await this.updateActor(primaryActorId, {
      identifiers: mergedIdentifiers,
      confidence: this.calculateActorConfidence(mergedIdentifiers),
      uncertainty_notes: [
        ...(primary.uncertainty_notes || []),
        ...(secondary.uncertainty_notes || []),
        `Merged with actor ${secondaryActorId} (${secondary.name})`,
      ],
    });

    await this.deleteActor(secondaryActorId);

    return mergedActor;
  }

  async getActorsForEvidence(evidenceId: string): Promise<ActorRecord[]> {
    await this.initialize();
    return Array.from(this.actorsStore.values()).filter((actor) =>
      actor.identifiers.some((id) => id.evidence_ids.includes(evidenceId))
    );
  }

  async linkActorToEvidence(actorId: string, evidenceId: string): Promise<void> {
    await this.initialize();
    const actor = this.actorsStore.get(actorId);
    if (!actor) return;

    const updatedIdentifiers = actor.identifiers.map((id) => {
      if (!id.evidence_ids.includes(evidenceId)) {
        return {
          ...id,
          evidence_ids: [...id.evidence_ids, evidenceId],
          last_seen: Date.now(),
        };
      }
      return id;
    });

    await this.updateActor(actorId, {
      identifiers: updatedIdentifiers,
      confidence: this.calculateActorConfidence(updatedIdentifiers),
    });
  }

  async unlinkActorFromEvidence(actorId: string, evidenceId: string): Promise<void> {
    await this.initialize();
    const actor = this.actorsStore.get(actorId);
    if (!actor) return;

    const updatedIdentifiers = actor.identifiers
      .map((id) => ({
        ...id,
        evidence_ids: id.evidence_ids.filter((eid) => eid !== evidenceId),
      }))
      .filter((id) => id.evidence_ids.length > 0);

    await this.updateActor(actorId, {
      identifiers: updatedIdentifiers,
      confidence: this.calculateActorConfidence(updatedIdentifiers),
    });
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

  // --------------------------------------------------
  // NARRATIVE CRUD
  // --------------------------------------------------

  async insertNarrative(n: Omit<NarrativeRecord, 'id'> & { id?: string }): Promise<NarrativeRecord> {
    await this.initialize();

    if (!this.casesStore.has(n.case_id)) {
      throw new Error(`FOREIGN KEY constraint failed: narratives.case_id (${n.case_id})`);
    }

    const rec: NarrativeRecord = {
      ...n,
      id: n.id || generateUUID(),
      user_reviewed: n.user_reviewed ?? false,
      user_edited: n.user_edited ?? false,
    };
    this.narrativesStore.set(rec.id, rec);
    return rec;
  }

  async getNarrativeById(id: string): Promise<NarrativeRecord | null> {
    await this.initialize();
    return this.narrativesStore.get(id) || null;
  }

  async getNarrativesForCase(caseId: string): Promise<NarrativeRecord[]> {
    await this.initialize();
    return Array.from(this.narrativesStore.values())
      .filter((n) => n.case_id === caseId)
      .sort((a, b) => b.generated_at - a.generated_at);
  }

  async getLatestNarrativeForCase(caseId: string): Promise<NarrativeRecord | null> {
    const narratives = await this.getNarrativesForCase(caseId);
    return narratives.length > 0 ? narratives[0] : null;
  }

  async updateNarrative(id: string, updates: Partial<NarrativeRecord>): Promise<NarrativeRecord | null> {
    await this.initialize();
    const current = this.narrativesStore.get(id);
    if (!current) return null;

    const rec: NarrativeRecord = {
      ...current,
      ...updates,
      id: current.id,
      case_id: current.case_id,
      user_reviewed: updates.user_reviewed ?? current.user_reviewed,
      user_edited: updates.user_edited ?? current.user_edited,
    };
    this.narrativesStore.set(id, rec);
    return rec;
  }

  async deleteNarrative(id: string): Promise<boolean> {
    await this.initialize();
    return this.narrativesStore.delete(id);
  }
}

export const databaseEngine = new DatabaseEngine();

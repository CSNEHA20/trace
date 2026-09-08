import * as SQLite from 'expo-sqlite';
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

interface RawEventRow {
  id: string;
  case_id: string;
  event_type: string;
  severity: number;
  timestamp: number;
  timestamp_hint: string | null;
  ai_summary: string | null;
  evidence_ids: string;
  actor_ids: string;
  source: string;
  user_annotation: string | null;
  user_edited: number;
  timestamp_conflict: number;
  timestamp_unresolved: number;
}

interface RawActorRow {
  id: string;
  case_id: string;
  name: string;
  role: string;
  contact_info: string | null;
  identifiers: string;
  confidence: number;
  uncertainty_notes: string | null;
  created_at: number;
  updated_at: number;
}

interface RawNarrativeRow {
  id: string;
  case_id: string;
  content: string;
  generated_at: number;
  events_snapshot: string;
  disclaimer: string;
  parse_error: string | null;
  user_reviewed: number;
  user_edited: number;
}

/**
 * TRACE Persistent SQLite Database Engine
 * Features: Local persistent SQLite storage via expo-sqlite, PRAGMA foreign_keys = ON,
 * schema migration versioning, native ACID transactions, parameterized SQL queries.
 */
export class DatabaseEngine {
  private isInitialized = false;
  private db: SQLite.SQLiteDatabase | null = null;
  private dbName = 'trace_vault.db';

  async initialize(customDbName?: string): Promise<void> {
    if (this.isInitialized && this.db) return;
    
    const targetName = customDbName || this.dbName;
    logger.info(`Initializing TRACE SQLite Database Engine (${targetName})...`);

    try {
      this.db = await SQLite.openDatabaseAsync(targetName);
      await this.db.execAsync('PRAGMA foreign_keys = ON;');

      // Run Schema Migrations
      await this.runMigrations();

      this.isInitialized = true;
      logger.info('TRACE SQLite Database Engine initialized successfully.');
    } catch (err) {
      this.isInitialized = false;
      this.db = null;
      logger.error('Failed to initialize TRACE SQLite Database Engine', err);
      throw err;
    }
  }

  getDatabase(): SQLite.SQLiteDatabase {
    if (!this.db) {
      throw new Error('DatabaseEngine is not initialized. Call initialize() before executing queries.');
    }
    return this.db;
  }

  async close(): Promise<void> {
    if (this.db) {
      await this.db.closeAsync();
      this.db = null;
      this.isInitialized = false;
    }
  }

  async resetDatabase(): Promise<void> {
    await this.close();
    (SQLite as any).__resetMockDatabase?.();
    await this.initialize();
  }

  async runMigrations(): Promise<number> {
    const db = this.getDatabase();
    
    // Ensure migrations history table exists
    await db.execAsync(
      `CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        applied_at INTEGER NOT NULL
      );`
    );

    const appliedRows = await db.getAllAsync<{ version: number }>(
      'SELECT version FROM schema_migrations ORDER BY version ASC;'
    );
    const appliedVersions = new Set(appliedRows.map((r: { version: number }) => r.version));

    let appliedCount = 0;
    for (const m of MIGRATIONS) {
      if (!appliedVersions.has(m.version)) {
        logger.info(`Applying migration v${m.version}: ${m.name}`);
        
        await db.withExclusiveTransactionAsync(async () => {
          for (const sql of m.upSql) {
            await db.execAsync(sql);
          }
          await db.runAsync(
            'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?);',
            [m.version, m.name, Date.now()]
          );
        });

        appliedCount++;
      }
    }
    return appliedCount;
  }

  async getAppliedMigrations(): Promise<SchemaMigrationRecord[]> {
    const db = this.getDatabase();
    return db.getAllAsync<SchemaMigrationRecord>(
      'SELECT version, name, applied_at FROM schema_migrations ORDER BY version ASC;'
    );
  }

  // --------------------------------------------------
  // NATIVE SQLITE TRANSACTIONS
  // --------------------------------------------------

  async transaction<T>(callback: (engine: DatabaseEngine) => Promise<T>): Promise<T> {
    await this.initialize();
    const db = this.getDatabase();

    let result!: T;
    await db.withExclusiveTransactionAsync(async () => {
      result = await callback(this);
    });
    return result;
  }

  // --------------------------------------------------
  // CASES CRUD
  // --------------------------------------------------

  async createCase(c: Omit<CaseRecord, 'id' | 'created_at' | 'updated_at'>): Promise<CaseRecord> {
    await this.initialize();
    const db = this.getDatabase();

    const now = Date.now();
    const id = generateUUID();
    const description = c.description ?? null;
    const status = c.status ?? 'ACTIVE';

    try {
      await db.runAsync(
        `INSERT INTO cases (id, case_number, title, description, investigator_name, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
        [id, c.case_number, c.title, description, c.investigator_name, status, now, now]
      );
    } catch (err: unknown) {
      const msg = (err as Error)?.message || '';
      if (msg.includes('UNIQUE constraint failed') || msg.includes('cases.case_number')) {
        throw new Error(`UNIQUE constraint failed: cases.case_number (${c.case_number})`);
      }
      throw err;
    }

    return {
      id,
      case_number: c.case_number,
      title: c.title,
      description: description ?? undefined,
      investigator_name: c.investigator_name,
      status,
      created_at: now,
      updated_at: now,
    };
  }

  async getCaseById(id: string): Promise<CaseRecord | null> {
    await this.initialize();
    const db = this.getDatabase();
    const row = await db.getFirstAsync<CaseRecord>(
      'SELECT id, case_number, title, description, investigator_name, status, created_at, updated_at FROM cases WHERE id = ?;',
      [id]
    );
    return row || null;
  }

  async getCaseByNumber(caseNumber: string): Promise<CaseRecord | null> {
    await this.initialize();
    const db = this.getDatabase();
    const row = await db.getFirstAsync<CaseRecord>(
      'SELECT id, case_number, title, description, investigator_name, status, created_at, updated_at FROM cases WHERE case_number = ?;',
      [caseNumber]
    );
    return row || null;
  }

  async getAllCases(): Promise<CaseRecord[]> {
    await this.initialize();
    const db = this.getDatabase();
    return db.getAllAsync<CaseRecord>(
      'SELECT id, case_number, title, description, investigator_name, status, created_at, updated_at FROM cases ORDER BY created_at DESC;'
    );
  }

  async updateCase(id: string, updates: Partial<CaseRecord>): Promise<CaseRecord | null> {
    await this.initialize();
    const db = this.getDatabase();

    const current = await this.getCaseById(id);
    if (!current) return null;

    const updated: CaseRecord = {
      ...current,
      ...updates,
      id,
      updated_at: Date.now(),
    };

    await db.runAsync(
      `UPDATE cases
       SET case_number = ?, title = ?, description = ?, investigator_name = ?, status = ?, updated_at = ?
       WHERE id = ?;`,
      [
        updated.case_number,
        updated.title,
        updated.description ?? null,
        updated.investigator_name,
        updated.status,
        updated.updated_at,
        id,
      ]
    );

    return updated;
  }

  async deleteCase(id: string): Promise<boolean> {
    await this.initialize();
    const db = this.getDatabase();
    const result = await db.runAsync('DELETE FROM cases WHERE id = ?;', [id]);
    return result.changes > 0;
  }

  // --------------------------------------------------
  // EVIDENCE CRUD
  // --------------------------------------------------

  async insertEvidence(e: Omit<EvidenceRecord, 'id'> & { id?: string }): Promise<EvidenceRecord> {
    await this.initialize();
    const db = this.getDatabase();

    const id = e.id || generateUUID();
    const exif_ts = e.exif_ts ?? null;
    const user_ts = e.user_ts ?? null;
    const ocr_text = e.ocr_text ?? null;
    const transcription = e.transcription ?? null;
    const sha256_processed = e.sha256_processed ?? null;

    try {
      await db.runAsync(
        `INSERT INTO evidence (id, case_id, file_path, media_type, import_ts, exif_ts, user_ts, ocr_text, transcription, sha256_import, sha256_processed)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          id,
          e.case_id,
          e.file_path,
          e.media_type,
          e.import_ts,
          exif_ts,
          user_ts,
          ocr_text,
          transcription,
          e.sha256_import,
          sha256_processed,
        ]
      );
    } catch (err: unknown) {
      const msg = (err as Error)?.message || '';
      if (msg.includes('FOREIGN KEY constraint failed') || msg.includes('evidence.case_id')) {
        throw new Error(`FOREIGN KEY constraint failed: evidence.case_id (${e.case_id})`);
      }
      throw err;
    }

    return {
      id,
      case_id: e.case_id,
      file_path: e.file_path,
      media_type: e.media_type,
      import_ts: e.import_ts,
      exif_ts: exif_ts ?? undefined,
      user_ts: user_ts ?? undefined,
      ocr_text: ocr_text ?? undefined,
      transcription: transcription ?? undefined,
      sha256_import: e.sha256_import,
      sha256_processed: sha256_processed ?? undefined,
    };
  }

  async getEvidenceById(id: string): Promise<EvidenceRecord | null> {
    await this.initialize();
    const db = this.getDatabase();
    const row = await db.getFirstAsync<EvidenceRecord>(
      'SELECT id, case_id, file_path, media_type, import_ts, exif_ts, user_ts, ocr_text, transcription, sha256_import, sha256_processed FROM evidence WHERE id = ?;',
      [id]
    );
    return row || null;
  }

  async getEvidenceForCase(caseId: string): Promise<EvidenceRecord[]> {
    await this.initialize();
    const db = this.getDatabase();
    return db.getAllAsync<EvidenceRecord>(
      'SELECT id, case_id, file_path, media_type, import_ts, exif_ts, user_ts, ocr_text, transcription, sha256_import, sha256_processed FROM evidence WHERE case_id = ? ORDER BY import_ts ASC;',
      [caseId]
    );
  }

  async getEvidenceByHash(sha256Import: string): Promise<EvidenceRecord | null> {
    await this.initialize();
    const db = this.getDatabase();
    const row = await db.getFirstAsync<EvidenceRecord>(
      'SELECT id, case_id, file_path, media_type, import_ts, exif_ts, user_ts, ocr_text, transcription, sha256_import, sha256_processed FROM evidence WHERE sha256_import = ?;',
      [sha256Import]
    );
    return row || null;
  }

  async updateEvidence(id: string, updates: Partial<EvidenceRecord>): Promise<EvidenceRecord | null> {
    await this.initialize();
    const db = this.getDatabase();

    const current = await this.getEvidenceById(id);
    if (!current) return null;

    const updated: EvidenceRecord = {
      ...current,
      ...updates,
      id,
      case_id: current.case_id,
    };

    await db.runAsync(
      `UPDATE evidence
       SET file_path = ?, media_type = ?, import_ts = ?, exif_ts = ?, user_ts = ?, ocr_text = ?, transcription = ?, sha256_import = ?, sha256_processed = ?
       WHERE id = ?;`,
      [
        updated.file_path,
        updated.media_type,
        updated.import_ts,
        updated.exif_ts ?? null,
        updated.user_ts ?? null,
        updated.ocr_text ?? null,
        updated.transcription ?? null,
        updated.sha256_import,
        updated.sha256_processed ?? null,
        id,
      ]
    );

    return updated;
  }

  async deleteEvidence(id: string): Promise<boolean> {
    await this.initialize();
    const db = this.getDatabase();
    const result = await db.runAsync('DELETE FROM evidence WHERE id = ?;', [id]);
    return result.changes > 0;
  }

  // --------------------------------------------------
  // EVENTS CRUD (JSON Serialization for evidence_ids & actor_ids)
  // --------------------------------------------------

  private mapRawEvent(row: RawEventRow): EventRecord {
    let evidence_ids: string[] = [];
    let actor_ids: string[] = [];

    try {
      evidence_ids = row.evidence_ids ? JSON.parse(row.evidence_ids) : [];
    } catch {
      evidence_ids = [];
    }

    try {
      actor_ids = row.actor_ids ? JSON.parse(row.actor_ids) : [];
    } catch {
      actor_ids = [];
    }

    return {
      id: row.id,
      case_id: row.case_id,
      event_type: row.event_type,
      severity: coerceEventSeverity(row.severity),
      timestamp: row.timestamp,
      timestamp_hint: row.timestamp_hint ?? undefined,
      ai_summary: row.ai_summary ?? undefined,
      evidence_ids,
      actor_ids,
      source: (row.source as 'system' | 'user') || 'system',
      user_annotation: row.user_annotation ?? undefined,
      user_edited: Boolean(row.user_edited),
      timestamp_conflict: Boolean(row.timestamp_conflict),
      timestamp_unresolved: Boolean(row.timestamp_unresolved),
    };
  }

  async insertEvent(
    ev: Omit<EventRecord, 'id' | 'severity'> & {
      id?: string;
      severity: EventRecord['severity'] | string | number;
    }
  ): Promise<EventRecord> {
    await this.initialize();
    const db = this.getDatabase();

    const id = ev.id || generateUUID();
    const severity = coerceEventSeverity(ev.severity);
    const serializedEvidenceIds = JSON.stringify(ev.evidence_ids || []);
    const serializedActorIds = JSON.stringify(ev.actor_ids || []);
    const source = ev.source ?? 'system';
    const timestamp_hint = ev.timestamp_hint ?? null;
    const ai_summary = ev.ai_summary ?? null;
    const user_annotation = ev.user_annotation ?? null;
    const user_edited = ev.user_edited ? 1 : 0;
    const timestamp_conflict = ev.timestamp_conflict ? 1 : 0;
    const timestamp_unresolved = ev.timestamp_unresolved ? 1 : 0;

    try {
      await db.runAsync(
        `INSERT INTO events (id, case_id, event_type, severity, timestamp, timestamp_hint, ai_summary, evidence_ids, actor_ids, source, user_annotation, user_edited, timestamp_conflict, timestamp_unresolved)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          id,
          ev.case_id,
          ev.event_type,
          severity,
          ev.timestamp,
          timestamp_hint,
          ai_summary,
          serializedEvidenceIds,
          serializedActorIds,
          source,
          user_annotation,
          user_edited,
          timestamp_conflict,
          timestamp_unresolved,
        ]
      );
    } catch (err: unknown) {
      const msg = (err as Error)?.message || '';
      if (msg.includes('FOREIGN KEY constraint failed') || msg.includes('events.case_id')) {
        throw new Error(`FOREIGN KEY constraint failed: events.case_id (${ev.case_id})`);
      }
      throw err;
    }

    return {
      id,
      case_id: ev.case_id,
      event_type: ev.event_type,
      severity,
      timestamp: ev.timestamp,
      timestamp_hint: ev.timestamp_hint,
      ai_summary: ev.ai_summary,
      evidence_ids: ev.evidence_ids || [],
      actor_ids: ev.actor_ids || [],
      source,
      user_annotation: ev.user_annotation,
      user_edited: Boolean(ev.user_edited),
      timestamp_conflict: Boolean(ev.timestamp_conflict),
      timestamp_unresolved: Boolean(ev.timestamp_unresolved),
    };
  }

  async updateEvent(id: string, updates: Partial<EventRecord>): Promise<EventRecord | null> {
    await this.initialize();
    const db = this.getDatabase();

    const current = await this.getEventById(id);
    if (!current) return null;

    const nextSeverity =
      updates.severity !== undefined ? coerceEventSeverity(updates.severity) : current.severity;

    const updated: EventRecord = {
      ...current,
      ...updates,
      id,
      case_id: current.case_id,
      severity: nextSeverity,
      evidence_ids: updates.evidence_ids ?? current.evidence_ids,
      actor_ids: updates.actor_ids ?? current.actor_ids,
    };

    await db.runAsync(
      `UPDATE events
       SET event_type = ?, severity = ?, timestamp = ?, timestamp_hint = ?, ai_summary = ?, evidence_ids = ?, actor_ids = ?, source = ?, user_annotation = ?, user_edited = ?, timestamp_conflict = ?, timestamp_unresolved = ?
       WHERE id = ?;`,
      [
        updated.event_type,
        updated.severity,
        updated.timestamp,
        updated.timestamp_hint ?? null,
        updated.ai_summary ?? null,
        JSON.stringify(updated.evidence_ids),
        JSON.stringify(updated.actor_ids),
        updated.source ?? null,
        updated.user_annotation ?? null,
        updated.user_edited ? 1 : 0,
        updated.timestamp_conflict ? 1 : 0,
        updated.timestamp_unresolved ? 1 : 0,
        id,
      ]
    );

    return updated;
  }

  async getEventById(id: string): Promise<EventRecord | null> {
    await this.initialize();
    const db = this.getDatabase();
    const row = await db.getFirstAsync<RawEventRow>(
      'SELECT id, case_id, event_type, severity, timestamp, timestamp_hint, ai_summary, evidence_ids, actor_ids, source, user_annotation, user_edited, timestamp_conflict, timestamp_unresolved FROM events WHERE id = ?;',
      [id]
    );
    return row ? this.mapRawEvent(row) : null;
  }

  async getEventsForCase(caseId: string): Promise<EventRecord[]> {
    await this.initialize();
    const db = this.getDatabase();
    const rows = await db.getAllAsync<RawEventRow>(
      'SELECT id, case_id, event_type, severity, timestamp, timestamp_hint, ai_summary, evidence_ids, actor_ids, source, user_annotation, user_edited, timestamp_conflict, timestamp_unresolved FROM events WHERE case_id = ? ORDER BY timestamp DESC;',
      [caseId]
    );
    return rows.map((r: RawEventRow) => this.mapRawEvent(r));
  }

  async deleteEvent(id: string): Promise<boolean> {
    await this.initialize();
    const db = this.getDatabase();
    const result = await db.runAsync('DELETE FROM events WHERE id = ?;', [id]);
    return result.changes > 0;
  }

  // --------------------------------------------------
  // ACTORS CRUD
  // --------------------------------------------------

  private mapRawActor(row: RawActorRow): ActorRecord {
    let identifiers: ActorIdentifier[] = [];
    try {
      identifiers = row.identifiers ? JSON.parse(row.identifiers) : [];
    } catch {
      identifiers = [];
    }

    let uncertainty_notes: string[] | undefined;
    try {
      if (row.uncertainty_notes) {
        uncertainty_notes = JSON.parse(row.uncertainty_notes);
      }
    } catch {
      uncertainty_notes = row.uncertainty_notes ? [row.uncertainty_notes] : undefined;
    }

    return {
      id: row.id,
      case_id: row.case_id,
      name: row.name,
      role: row.role as ActorRecord['role'],
      contact_info: row.contact_info ?? undefined,
      identifiers,
      confidence: row.confidence ?? 0,
      uncertainty_notes,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  async insertActor(
    a: Omit<ActorRecord, 'id' | 'created_at' | 'updated_at'> & { id?: string }
  ): Promise<ActorRecord> {
    await this.initialize();
    const db = this.getDatabase();

    const id = a.id || generateUUID();
    const now = Date.now();
    const contact_info = a.contact_info ?? null;
    const serializedIdentifiers = JSON.stringify(a.identifiers || []);
    const confidence = a.confidence ?? 0;
    const uncertainty_notes = a.uncertainty_notes ? JSON.stringify(a.uncertainty_notes) : null;

    try {
      await db.runAsync(
        `INSERT INTO actors (id, case_id, name, role, contact_info, identifiers, confidence, uncertainty_notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          id,
          a.case_id,
          a.name,
          a.role,
          contact_info,
          serializedIdentifiers,
          confidence,
          uncertainty_notes,
          now,
          now,
        ]
      );
    } catch (err: unknown) {
      const msg = (err as Error)?.message || '';
      if (msg.includes('FOREIGN KEY constraint failed') || msg.includes('actors.case_id')) {
        throw new Error(`FOREIGN KEY constraint failed: actors.case_id (${a.case_id})`);
      }
      throw err;
    }

    return {
      id,
      case_id: a.case_id,
      name: a.name,
      role: a.role,
      contact_info: a.contact_info,
      identifiers: a.identifiers || [],
      confidence,
      uncertainty_notes: a.uncertainty_notes,
      created_at: now,
      updated_at: now,
    };
  }

  async updateActor(id: string, updates: Partial<ActorRecord>): Promise<ActorRecord | null> {
    await this.initialize();
    const db = this.getDatabase();

    const current = await this.getActorById(id);
    if (!current) return null;

    const updated: ActorRecord = {
      ...current,
      ...updates,
      id,
      case_id: current.case_id,
      created_at: current.created_at,
      updated_at: Date.now(),
    };

    const contact_info = updated.contact_info ?? null;
    const serializedIdentifiers = JSON.stringify(updated.identifiers || []);
    const uncertainty_notes = updated.uncertainty_notes ? JSON.stringify(updated.uncertainty_notes) : null;

    await db.runAsync(
      `UPDATE actors
       SET name = ?, role = ?, contact_info = ?, identifiers = ?, confidence = ?, uncertainty_notes = ?, updated_at = ?
       WHERE id = ?;`,
      [
        updated.name,
        updated.role,
        contact_info,
        serializedIdentifiers,
        updated.confidence,
        uncertainty_notes,
        updated.updated_at,
        id,
      ]
    );

    return updated;
  }

  async getActorById(id: string): Promise<ActorRecord | null> {
    await this.initialize();
    const db = this.getDatabase();
    const row = await db.getFirstAsync<RawActorRow>(
      'SELECT id, case_id, name, role, contact_info, identifiers, confidence, uncertainty_notes, created_at, updated_at FROM actors WHERE id = ?;',
      [id]
    );
    return row ? this.mapRawActor(row) : null;
  }

  async getActorsForCase(caseId: string): Promise<ActorRecord[]> {
    await this.initialize();
    const db = this.getDatabase();
    const rows = await db.getAllAsync<RawActorRow>(
      'SELECT id, case_id, name, role, contact_info, identifiers, confidence, uncertainty_notes, created_at, updated_at FROM actors WHERE case_id = ? ORDER BY created_at ASC;',
      [caseId]
    );
    return rows.map((r: RawActorRow) => this.mapRawActor(r));
  }

  async deleteActor(id: string): Promise<boolean> {
    await this.initialize();
    const db = this.getDatabase();
    const result = await db.runAsync('DELETE FROM actors WHERE id = ?;', [id]);
    return result.changes > 0;
  }

  async addIdentifier(actorId: string, identifier: ActorIdentifier): Promise<ActorRecord | null> {
    const actor = await this.getActorById(actorId);
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
    const actors = await this.getActorsForCase(caseId);

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
    const actors = await this.getActorsForCase(caseId);
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
    const primary = await this.getActorById(primaryActorId);
    const secondary = await this.getActorById(secondaryActorId);
    
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

    let mergedActor: ActorRecord | null = null;
    await this.transaction(async (engine) => {
      mergedActor = await engine.updateActor(primaryActorId, {
        identifiers: mergedIdentifiers,
        confidence: this.calculateActorConfidence(mergedIdentifiers),
        uncertainty_notes: [
          ...(primary.uncertainty_notes || []),
          ...(secondary.uncertainty_notes || []),
          `Merged with actor ${secondaryActorId} (${secondary.name})`,
        ],
      });
      await engine.deleteActor(secondaryActorId);
    });

    return mergedActor;
  }

  async getActorsForEvidence(evidenceId: string): Promise<ActorRecord[]> {
    await this.initialize();
    const db = this.getDatabase();
    const all = await db.getAllAsync<RawActorRow>(
      'SELECT id, case_id, name, role, contact_info, identifiers, confidence, uncertainty_notes, created_at, updated_at FROM actors;'
    );
    return all
      .map((r: RawActorRow) => this.mapRawActor(r))
      .filter((actor: ActorRecord) => actor.identifiers.some((id: ActorIdentifier) => id.evidence_ids.includes(evidenceId)));
  }

  async linkActorToEvidence(actorId: string, evidenceId: string): Promise<void> {
    const actor = await this.getActorById(actorId);
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
    const actor = await this.getActorById(actorId);
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
    const db = this.getDatabase();

    const id = hc.id || generateUUID();

    try {
      await db.runAsync(
        `INSERT INTO hash_chain (id, evidence_id, operation, payload_hash, chain_hash, timestamp)
         VALUES (?, ?, ?, ?, ?, ?);`,
        [id, hc.evidence_id, hc.operation, hc.payload_hash, hc.chain_hash, hc.timestamp]
      );
    } catch (err: unknown) {
      const msg = (err as Error)?.message || '';
      if (msg.includes('FOREIGN KEY constraint failed') || msg.includes('hash_chain.evidence_id')) {
        throw new Error(`FOREIGN KEY constraint failed: hash_chain.evidence_id (${hc.evidence_id})`);
      }
      throw err;
    }

    return {
      id,
      evidence_id: hc.evidence_id,
      operation: hc.operation,
      payload_hash: hc.payload_hash,
      chain_hash: hc.chain_hash,
      timestamp: hc.timestamp,
    };
  }

  async getHashChainForEvidence(evidenceId: string): Promise<HashChainRecord[]> {
    await this.initialize();
    const db = this.getDatabase();
    return db.getAllAsync<HashChainRecord>(
      'SELECT id, evidence_id, operation, payload_hash, chain_hash, timestamp FROM hash_chain WHERE evidence_id = ? ORDER BY rowid ASC, timestamp ASC;',
      [evidenceId]
    );
  }

  async getHashChainForCase(caseId: string): Promise<HashChainRecord[]> {
    await this.initialize();
    const db = this.getDatabase();
    return db.getAllAsync<HashChainRecord>(
      `SELECT hc.id, hc.evidence_id, hc.operation, hc.payload_hash, hc.chain_hash, hc.timestamp 
       FROM hash_chain hc 
       JOIN evidence e ON hc.evidence_id = e.id 
       WHERE e.case_id = ? 
       ORDER BY hc.rowid ASC, hc.timestamp ASC;`,
      [caseId]
    );
  }

  async getAllHashChainNodes(): Promise<HashChainRecord[]> {
    await this.initialize();
    const db = this.getDatabase();
    return db.getAllAsync<HashChainRecord>(
      'SELECT id, evidence_id, operation, payload_hash, chain_hash, timestamp FROM hash_chain ORDER BY rowid ASC, timestamp ASC;'
    );
  }

  async getLatestHashChainNode(evidenceId: string): Promise<HashChainRecord | null> {
    await this.initialize();
    const db = this.getDatabase();
    const row = await db.getFirstAsync<HashChainRecord>(
      'SELECT id, evidence_id, operation, payload_hash, chain_hash, timestamp FROM hash_chain WHERE evidence_id = ? ORDER BY rowid DESC, timestamp DESC LIMIT 1;',
      [evidenceId]
    );
    return row || null;
  }

  // --------------------------------------------------
  // NARRATIVE CRUD
  // --------------------------------------------------

  private mapRawNarrative(row: RawNarrativeRow): NarrativeRecord {
    return {
      id: row.id,
      case_id: row.case_id,
      content: row.content,
      generated_at: row.generated_at,
      events_snapshot: row.events_snapshot || '[]',
      disclaimer: row.disclaimer,
      parse_error: row.parse_error ?? undefined,
      user_reviewed: Boolean(row.user_reviewed),
      user_edited: Boolean(row.user_edited),
    };
  }

  async insertNarrative(n: Omit<NarrativeRecord, 'id'> & { id?: string }): Promise<NarrativeRecord> {
    await this.initialize();
    const db = this.getDatabase();

    const id = n.id || generateUUID();
    const serializedEventsSnapshot = typeof n.events_snapshot === 'string'
      ? n.events_snapshot
      : JSON.stringify(n.events_snapshot || []);
    const parse_error = n.parse_error ?? null;
    const user_reviewed = n.user_reviewed ? 1 : 0;
    const user_edited = n.user_edited ? 1 : 0;

    try {
      await db.runAsync(
        `INSERT INTO narratives (id, case_id, content, generated_at, events_snapshot, disclaimer, parse_error, user_reviewed, user_edited)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          id,
          n.case_id,
          n.content,
          n.generated_at,
          serializedEventsSnapshot,
          n.disclaimer,
          parse_error,
          user_reviewed,
          user_edited,
        ]
      );
    } catch (err: unknown) {
      const msg = (err as Error)?.message || '';
      if (msg.includes('FOREIGN KEY constraint failed') || msg.includes('narratives.case_id')) {
        throw new Error(`FOREIGN KEY constraint failed: narratives.case_id (${n.case_id})`);
      }
      throw err;
    }

    return {
      id,
      case_id: n.case_id,
      content: n.content,
      generated_at: n.generated_at,
      events_snapshot: serializedEventsSnapshot,
      disclaimer: n.disclaimer,
      parse_error: n.parse_error,
      user_reviewed: Boolean(n.user_reviewed),
      user_edited: Boolean(n.user_edited),
    };
  }

  async getNarrativeById(id: string): Promise<NarrativeRecord | null> {
    await this.initialize();
    const db = this.getDatabase();
    const row = await db.getFirstAsync<RawNarrativeRow>(
      'SELECT id, case_id, content, generated_at, events_snapshot, disclaimer, parse_error, user_reviewed, user_edited FROM narratives WHERE id = ?;',
      [id]
    );
    return row ? this.mapRawNarrative(row) : null;
  }

  async getNarrativesForCase(caseId: string): Promise<NarrativeRecord[]> {
    await this.initialize();
    const db = this.getDatabase();
    const rows = await db.getAllAsync<RawNarrativeRow>(
      'SELECT id, case_id, content, generated_at, events_snapshot, disclaimer, parse_error, user_reviewed, user_edited FROM narratives WHERE case_id = ? ORDER BY generated_at DESC;',
      [caseId]
    );
    return rows.map((r: RawNarrativeRow) => this.mapRawNarrative(r));
  }

  async getLatestNarrativeForCase(caseId: string): Promise<NarrativeRecord | null> {
    await this.initialize();
    const db = this.getDatabase();
    const row = await db.getFirstAsync<RawNarrativeRow>(
      'SELECT id, case_id, content, generated_at, events_snapshot, disclaimer, parse_error, user_reviewed, user_edited FROM narratives WHERE case_id = ? ORDER BY generated_at DESC LIMIT 1;',
      [caseId]
    );
    return row ? this.mapRawNarrative(row) : null;
  }

  async updateNarrative(id: string, updates: Partial<NarrativeRecord>): Promise<NarrativeRecord | null> {
    await this.initialize();
    const db = this.getDatabase();

    const current = await this.getNarrativeById(id);
    if (!current) return null;

    const updated: NarrativeRecord = {
      ...current,
      ...updates,
      id,
      case_id: current.case_id,
    };

    const serializedEventsSnapshot = JSON.stringify(updated.events_snapshot || []);
    const parse_error = updated.parse_error ?? null;
    const user_reviewed = updated.user_reviewed ? 1 : 0;
    const user_edited = updated.user_edited ? 1 : 0;

    await db.runAsync(
      `UPDATE narratives
       SET content = ?, generated_at = ?, events_snapshot = ?, disclaimer = ?, parse_error = ?, user_reviewed = ?, user_edited = ?
       WHERE id = ?;`,
      [
        updated.content,
        updated.generated_at,
        serializedEventsSnapshot,
        updated.disclaimer,
        parse_error,
        user_reviewed,
        user_edited,
        id,
      ]
    );

    return updated;
  }

  async deleteNarrative(id: string): Promise<boolean> {
    await this.initialize();
    const db = this.getDatabase();
    const result = await db.runAsync('DELETE FROM narratives WHERE id = ?;', [id]);
    return result.changes > 0;
  }
}

export const databaseEngine = new DatabaseEngine();

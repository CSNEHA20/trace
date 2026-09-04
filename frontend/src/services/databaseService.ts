import {
  CaseRecord,
  EvidenceRecord,
  EventRecord,
  ActorRecord,
  HashChainRecord,
  Case,
  EvidenceItem,
  TimelineEvent,
} from '../types';
import { databaseEngine } from '../../../database/services/databaseEngine';
import { generateUUID } from '../utils/crypto';
import { logger } from '../utils/logger';

/**
 * Frontend DatabaseService — thin facade over DatabaseEngine
 * Maps CaseRecord / EvidenceRecord to legacy UI types (Case, EvidenceItem)
 * and delegates all persistence to the DatabaseEngine.
 */
class DatabaseService {
  async initialize(): Promise<void> {
    await databaseEngine.initialize();
  }

  // ---- CASES ----

  async getAllCases(): Promise<Case[]> {
    const recs = await databaseEngine.getAllCases();
    return recs.map(this.mapCaseRecordToCase);
  }

  async getCaseById(id: string): Promise<Case | null> {
    const rec = await databaseEngine.getCaseById(id);
    if (!rec) return null;
    return this.mapCaseRecordToCase(rec);
  }

  async createCase(title: string, description: string, investigatorName: string): Promise<Case> {
    const rec = await databaseEngine.createCase({
      case_number: `TR-2026-${Math.floor(1000 + Math.random() * 9000)}`,
      title,
      description,
      investigator_name: investigatorName,
      status: 'ACTIVE',
    });
    return this.mapCaseRecordToCase(rec);
  }

  private mapCaseRecordToCase(rec: CaseRecord): Case {
    return {
      id: rec.id,
      caseNumber: rec.case_number,
      title: rec.title,
      description: rec.description,
      investigatorName: rec.investigator_name,
      status: rec.status,
      createdAt: rec.created_at,
      updatedAt: rec.updated_at,
      evidenceIds: [],
    };
  }

  // ---- EVIDENCE ----

  async getEvidenceByHash(sha256: string): Promise<EvidenceItem | null> {
    const rec = await databaseEngine.getEvidenceByHash(sha256);
    if (!rec) return null;
    return this.mapEvidenceRecordToItem(rec);
  }

  async getAllEvidence(): Promise<EvidenceItem[]> {
    const allCases = await databaseEngine.getAllCases();
    const all: EvidenceItem[] = [];
    for (const c of allCases) {
      const recs = await databaseEngine.getEvidenceForCase(c.id);
      all.push(...recs.map(this.mapEvidenceRecordToItem));
    }
    return all;
  }

  async getEvidenceForCase(caseId: string): Promise<EvidenceItem[]> {
    const recs = await databaseEngine.getEvidenceForCase(caseId);
    return recs.map(this.mapEvidenceRecordToItem);
  }

  async getEvidenceById(id: string): Promise<EvidenceItem | null> {
    const rec = await databaseEngine.getEvidenceById(id);
    if (!rec) return null;
    return this.mapEvidenceRecordToItem(rec);
  }

  async addEvidence(item: Omit<EvidenceItem, 'id' | 'timestamp'>): Promise<EvidenceItem> {
    // Store only file_path reference in DB — never raw binary evidence data
    const rec = await databaseEngine.insertEvidence({
      case_id: item.caseId,
      file_path: item.fileUri,
      media_type: item.type,
      import_ts: Date.now(),
      sha256_import: item.sha256Hash,
      sha256_processed: item.sha256Hash,
      ocr_text: item.aiAnalysis?.detectedText?.join('\n'),
      transcription: item.aiAnalysis?.transcription,
    });

    // Append hash chain entry for the imported evidence
    await this.appendHashChain(rec.id, 'IMPORT', rec.sha256_import);

    return this.mapEvidenceRecordToItem(rec);
  }

  async updateEvidenceTranscription(
    evidenceId: string,
    transcription: string,
    processingHash: string
  ): Promise<EvidenceItem | null> {
    const updated = await databaseEngine.updateEvidence(evidenceId, {
      transcription,
      sha256_processed: processingHash,
    });
    if (!updated) return null;
    return this.mapEvidenceRecordToItem(updated);
  }


  private mapEvidenceRecordToItem(rec: EvidenceRecord): EvidenceItem {
    return {
      id: rec.id,
      caseId: rec.case_id,
      title: `Evidence ${rec.id.substring(0, 8)}`,
      type: rec.media_type,
      fileUri: rec.file_path,
      fileName: rec.file_path.split('/').pop() || rec.id,
      fileSize: 0,
      mimeType: rec.media_type === 'IMAGE' ? 'image/jpeg' : rec.media_type === 'AUDIO' ? 'audio/wav' : 'application/octet-stream',
      sha256Hash: rec.sha256_import,
      signature: `SIG_TRACE_HARDWARE_${rec.sha256_import.substring(0, 16)}`,
      timestamp: rec.import_ts,
      aiAnalysis: rec.ocr_text || rec.transcription ? {
        detectedText: rec.ocr_text ? rec.ocr_text.split('\n') : undefined,
        transcription: rec.transcription,
      } : undefined,
      isTampered: rec.sha256_processed !== undefined && rec.sha256_processed !== rec.sha256_import,
    };
  }

  // ---- EVENTS / TIMELINE ----

  async getTimelineForCase(caseId: string): Promise<TimelineEvent[]> {
    const evs = await databaseEngine.getEventsForCase(caseId);
    return evs.map((ev) => ({
      id: ev.id,
      caseId: ev.case_id,
      timestamp: ev.timestamp,
      title: ev.event_type,
      description: ev.ai_summary || ev.event_type,
      category: ev.event_type,
    }));
  }

  async getAllTimelineEvents(): Promise<TimelineEvent[]> {
    const allCases = await databaseEngine.getAllCases();
    const all: TimelineEvent[] = [];
    for (const c of allCases) {
      const evs = await this.getTimelineForCase(c.id);
      all.push(...evs);
    }
    return all.sort((a, b) => b.timestamp - a.timestamp);
  }

  async addTimelineEvent(event: Omit<TimelineEvent, 'id'>): Promise<TimelineEvent> {
    const rec = await databaseEngine.insertEvent({
      case_id: event.caseId,
      event_type: event.category,
      severity: 'MEDIUM',
      timestamp: event.timestamp,
      ai_summary: event.description,
      evidence_ids: event.evidenceId ? [event.evidenceId] : [],
      actor_ids: [],
    });
    return {
      id: rec.id,
      caseId: rec.case_id,
      timestamp: rec.timestamp,
      title: rec.event_type,
      description: rec.ai_summary || rec.event_type,
      category: rec.event_type,
    };
  }

  // ---- HASH CHAIN ----

  async appendHashChain(evidenceId: string, operation: string, payloadHash: string): Promise<HashChainRecord> {
    const prev = await databaseEngine.getLatestHashChainNode(evidenceId);
    const prevChainHash = prev?.chain_hash || '0000000000000000000000000000000000000000000000000000000000000000';
    // Deterministic chain_hash = hash of (prevChainHash + payloadHash)
    const combined = prevChainHash + payloadHash + evidenceId + operation;
    let chainHash = 0;
    for (let i = 0; i < combined.length; i++) {
      chainHash = (chainHash << 5) - chainHash + combined.charCodeAt(i);
      chainHash |= 0;
    }
    const hexChainHash = `${Math.abs(chainHash).toString(16).padStart(8, '0')}${payloadHash.substring(8, 64)}`;

    return databaseEngine.insertHashChain({
      evidence_id: evidenceId,
      operation,
      payload_hash: payloadHash,
      chain_hash: hexChainHash,
      timestamp: Date.now(),
    });
  }

  async getHashChainForEvidence(evidenceId: string): Promise<HashChainRecord[]> {
    return databaseEngine.getHashChainForEvidence(evidenceId);
  }

  // ---- ACTORS ----

  async insertActor(caseId: string, name: string, role: string, contactInfo?: string): Promise<ActorRecord> {
    return databaseEngine.insertActor({ case_id: caseId, name, role, contact_info: contactInfo });
  }

  async getActorsForCase(caseId: string): Promise<ActorRecord[]> {
    return databaseEngine.getActorsForCase(caseId);
  }
}

export const databaseService = new DatabaseService();

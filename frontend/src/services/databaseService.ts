import {
  CaseRecord,
  EvidenceRecord,
  EventRecord,
  ActorRecord,
  HashChainRecord,
  NarrativeRecord,
  Case,
  EvidenceItem,
  TimelineEvent,
} from '../types';
import { databaseEngine } from '../../../database/services/databaseEngine';
import { generateUUID } from '../utils/crypto';
import { logger } from '../utils/logger';
import { chainService } from './chainService';
import { ChainOperation } from '../types/integrity';

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

  async getEventRecordsForCase(caseId: string): Promise<EventRecord[]> {
    return databaseEngine.getEventsForCase(caseId);
  }

  async updateEventRecord(id: string, updates: Partial<EventRecord>): Promise<EventRecord | null> {
    return databaseEngine.updateEvent(id, updates);
  }

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
      severity: 3,
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

  async appendHashChain(evidenceId: string, operation: ChainOperation, payloadHash: string): Promise<HashChainRecord> {
    // Delegate to the proper SHA-256 chain service
    const node = await chainService.appendNode({
      evidenceId,
      operation,
      data: { payload_hash: payloadHash },
    });
    return {
      id: node.id,
      evidence_id: node.evidence_id,
      operation: node.operation,
      payload_hash: node.payload_hash,
      chain_hash: node.chain_hash,
      timestamp: node.timestamp,
    };
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

  // ---- NARRATIVES ----

  async saveNarrative(caseId: string, narrative: {
    content: string;
    eventsSnapshot: string[];
    disclaimer: string;
    parseError?: string;
  }): Promise<NarrativeRecord> {
    return databaseEngine.insertNarrative({
      case_id: caseId,
      content: narrative.content,
      generated_at: Date.now(),
      events_snapshot: JSON.stringify(narrative.eventsSnapshot),
      disclaimer: narrative.disclaimer,
      parse_error: narrative.parseError,
    });
  }

  async getNarrativesForCase(caseId: string): Promise<NarrativeRecord[]> {
    return databaseEngine.getNarrativesForCase(caseId);
  }

  async getLatestNarrativeForCase(caseId: string): Promise<NarrativeRecord | null> {
    return databaseEngine.getLatestNarrativeForCase(caseId);
  }

  async markNarrativeReviewed(narrativeId: string, reviewed: boolean, edited: boolean = false): Promise<NarrativeRecord | null> {
    return databaseEngine.updateNarrative(narrativeId, {
      user_reviewed: reviewed,
      user_edited: edited,
    });
  }
}

export const databaseService = new DatabaseService();

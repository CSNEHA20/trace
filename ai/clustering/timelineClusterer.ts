import { EventRecord, IncidentSeverity } from '../../frontend/src/types';
import { GEMMA_PROMPTS } from '../prompts/gemmaPrompts';
import { chunkEvidenceText, JsonInferenceResult } from '../inference/inferenceJson';
import { GEMMA_2B_INT4_SPEC } from '../models/modelConfig';
import { databaseEngine } from '../../database/services/databaseEngine';
import { chainService } from '../../frontend/src/services/chainService';
import { hashService } from '../../frontend/src/services/hashService';
import { buildEvidenceCorpus } from './evidenceCorpus';
import { ClusterOperationResult } from './clusterTypes';
import { RECONSTRUCTION_DISCLAIMER, RejectedClusterItem, ValidatedIncidentEvent } from './eventTypes';
import { dedupeValidatedEvents, isIncidentEventType, parseClusterPayload, parseIncidentSeverity, validateModelEvent } from './eventSchema';

export interface ClusterInferencer {
  inferJson(
    instruction: string,
    evidenceText: string,
    onProgress?: (progress: { stage: string; completedChunks: number; totalChunks: number; message: string }) => void,
    timeoutMs?: number
  ): Promise<JsonInferenceResult[]>;
}

export interface ClusterOptions {
  inferencer?: ClusterInferencer;
  onProgress?: (progress: { stage: string; completedChunks: number; totalChunks: number; message: string }) => void;
}

function canonicalEventPayload(event: ValidatedIncidentEvent) {
  return {
    event_type: event.event_type,
    evidence_refs: [...event.evidence_refs].sort(),
    severity: event.severity,
    summary: event.summary,
    timestamp: event.timestamp,
    timestamp_conflict: event.timestamp_conflict,
    timestamp_hint: event.timestamp_hint,
    timestamp_unresolved: event.timestamp_unresolved,
  };
}

export class TimelineClusterer {
  /**
   * Run Gemma 2B incident clustering for a case.
   * Malformed model output is rejected; nothing is persisted from an invalid chunk.
   */
  async clusterCase(caseId: string, options: ClusterOptions = {}): Promise<ClusterOperationResult> {
    const caseRecord = await databaseEngine.getCaseById(caseId);
    if (!caseRecord) {
      throw new Error(`Case ${caseId} was not found.`);
    }

    const evidence = await databaseEngine.getEvidenceForCase(caseId);
    const corpus = buildEvidenceCorpus(caseId, evidence);
    const contributing = corpus.items.filter((item) => item.extractedText.length > 0);
    const chunksPreview = chunkEvidenceText(corpus.combinedText, GEMMA_2B_INT4_SPEC.contextLength);

    if (evidence.length === 0) {
      return this.emptyResult(caseId, 0, 'NO_EVIDENCE', []);
    }

    if (contributing.length === 0) {
      const chainNodeIds = await this.appendClusterChain(
        corpus.items.map((item) => item.id),
        caseId,
        [],
        [],
        'NO_EXTRACTED_TEXT'
      );
      return this.emptyResult(caseId, 0, 'NO_EXTRACTED_TEXT', chainNodeIds);
    }

    const instruction = [
      GEMMA_PROMPTS.TIMELINE_CLUSTERING,
      'EVIDENCE CATALOG (use only these ids or E# tokens in evidence_refs):',
      corpus.catalogText,
    ].join('\n\n');

    const inferencer = options.inferencer ?? (await import('../inference/inferenceService')).onDeviceInferenceService;
    const chunkResults = await inferencer.inferJson(
      instruction,
      corpus.combinedText,
      options.onProgress
    );

    const accepted: ValidatedIncidentEvent[] = [];
    const rejected: RejectedClusterItem[] = [];

    for (const result of chunkResults) {
      if (result.parseError) {
        rejected.push({
          code: 'MALFORMED_JSON',
          reason: result.parseError,
          raw: result.raw,
        });
        continue;
      }
      const payload = parseClusterPayload(result.raw);
      if (payload.parseError || !payload.events) {
        rejected.push({
          code: 'MALFORMED_JSON',
          reason: payload.parseError || 'Chunk did not contain a JSON event list.',
          raw: result.raw,
        });
        continue;
      }
      for (const rawEvent of payload.events) {
        const outcome = validateModelEvent(rawEvent, corpus);
        if (outcome.rejection) {
          rejected.push(outcome.rejection);
          continue;
        }
        if (outcome.event) accepted.push(outcome.event);
      }
    }

    const unique = dedupeValidatedEvents(accepted);
    await this.replaceUneditedAiEvents(caseId);

    const persisted: EventRecord[] = [];
    await databaseEngine.transaction(async (engine) => {
      for (const event of unique) {
        const rec = await engine.insertEvent({
          case_id: caseId,
          event_type: event.event_type,
          severity: event.severity,
          timestamp: event.timestamp,
          timestamp_hint: event.timestamp_hint,
          ai_summary: event.summary,
          evidence_ids: event.evidence_refs,
          actor_ids: [],
          source: 'ai',
          user_edited: false,
          timestamp_conflict: event.timestamp_conflict,
          timestamp_unresolved: event.timestamp_unresolved,
        });
        persisted.push(rec);
      }
    });

    const evidenceIds = [...new Set(unique.flatMap((event) => event.evidence_refs))].sort();
    const chainTargets = evidenceIds.length ? evidenceIds : contributing.map((item) => item.id);
    const chainNodeIds = await this.appendClusterChain(chainTargets, caseId, unique, rejected, undefined);

    return {
      caseId,
      persisted,
      rejected,
      chunks: chunkResults.length || chunksPreview.length,
      reconstructionDisclaimer: RECONSTRUCTION_DISCLAIMER,
      chainNodeIds,
      skippedReason: undefined,
    };
  }

  async annotateEvent(
    eventId: string,
    updates: {
      event_type?: string;
      severity?: number;
      ai_summary?: string;
      user_annotation?: string;
      timestamp_hint?: string | null;
    }
  ): Promise<EventRecord> {
    const current = await databaseEngine.getEventById(eventId);
    if (!current) throw new Error(`Event ${eventId} was not found.`);
    if (updates.event_type !== undefined && !isIncidentEventType(updates.event_type)) {
      throw new Error(`event_type "${updates.event_type}" is not an allowed incident type.`);
    }
    if (updates.severity !== undefined && parseIncidentSeverity(updates.severity) === undefined) {
      throw new Error('severity must be an integer from 1 to 5');
    }
    const updated = await databaseEngine.updateEvent(eventId, {
      ...updates,
      severity: updates.severity !== undefined ? (updates.severity as IncidentSeverity) : undefined,
      user_edited: true,
    });
    if (!updated) throw new Error(`Event ${eventId} could not be updated.`);
    return updated;
  }

  private async replaceUneditedAiEvents(caseId: string): Promise<void> {
    const existing = await databaseEngine.getEventsForCase(caseId);
    for (const event of existing) {
      if (event.source === 'ai' && !event.user_edited) {
        await databaseEngine.deleteEvent(event.id);
      }
    }
  }

  private emptyResult(
    caseId: string,
    chunks: number,
    skippedReason: 'NO_EXTRACTED_TEXT' | 'NO_EVIDENCE',
    chainNodeIds: string[]
  ): ClusterOperationResult {
    return {
      caseId,
      persisted: [],
      rejected: [],
      chunks,
      skippedReason,
      reconstructionDisclaimer: RECONSTRUCTION_DISCLAIMER,
      chainNodeIds,
    };
  }

  private async appendClusterChain(
    evidenceIds: string[],
    caseId: string,
    events: ValidatedIncidentEvent[],
    rejected: RejectedClusterItem[],
    skippedReason?: string
  ): Promise<string[]> {
    const nodeIds: string[] = [];
    const data = {
      case_id: caseId,
      events: events.map(canonicalEventPayload),
      rejected_codes: rejected.map((item) => item.code).sort(),
      rejected_count: rejected.length,
      skipped_reason: skippedReason ?? null,
    };
    const payloadHash = await hashService.computeProcessingHash(JSON.stringify(data));
    for (const evidenceId of [...evidenceIds].sort()) {
      const node = await chainService.appendNode({
        evidenceId,
        operation: 'CLUSTER',
        data: { ...data, payload_hash: payloadHash },
      });
      nodeIds.push(node.id);
    }
    return nodeIds;
  }
}

export const timelineClusterer = new TimelineClusterer();

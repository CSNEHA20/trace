import { databaseEngine } from '../../../database/services/databaseEngine';
import { databaseService } from './databaseService';
import { hashService } from './hashService';
import { logger } from '../utils/logger';
import {
  onDeviceInferenceService,
  InferenceProgress,
  ForensicExtractionResult,
} from '../../../ai/inference/inferenceService';
import {
  ForensicExtractionSchema,
  ForensicFact,
  ForensicActor,
  ForensicEvent,
} from '../../../ai/prompts/gemmaPrompts';
import { EventRecord, ActorRecord, NarrativeRecord, ActorRole, ActorIdentifier } from '../types';

export interface ForensicAnalysisOptions {
  evidenceIds?: string[];
  onProgress?: (progress: InferenceProgress) => void;
  timeoutMs?: number;
}

export interface CompleteForensicAnalysisResult {
  caseId: string;
  schema: ForensicExtractionSchema;
  narrativeRecord: NarrativeRecord;
  persistedEventIds: string[];
  persistedActorIds: string[];
  hashChainNodeId: string;
  payloadHash: string;
  durationMs: number;
  evidenceCount: number;
}

/**
 * End-to-End Forensic Analysis Pipeline.
 * 
 * Flow:
 * Evidence Files (OCR / Whisper / Text / Metadata)
 *   ↓
 * Normalized Forensic Evidence Context
 *   ↓
 * On-Device Gemma 2B INT4 (MediaPipe LLM Task)
 *   ↓
 * Validated Forensic Extraction Schema (Explicit vs Inferred)
 *   ↓
 * SQLite Persistence (Narratives, Events, Actors)
 *   ↓
 * Cryptographic Hash Chain Ledger (Operation: ANALYZE / EXTRACT)
 */
export class ForensicAnalysisService {
  async analyzeCaseEvidence(
    caseId: string,
    options: ForensicAnalysisOptions = {}
  ): Promise<CompleteForensicAnalysisResult> {
    const notify = (stage: InferenceProgress['stage'], message: string, completed = 0, total = 1) => {
      options.onProgress?.({
        stage,
        completedChunks: completed,
        totalChunks: total,
        message,
      });
    };

    logger.info(`[ForensicAnalysisService] Starting on-device Gemma analysis for case ${caseId}`);
    notify('CHECKING', 'Validating case evidence items…');

    // ── 1. Fetch Case & Evidence from SQLite ─────────────────────────────────
    const caseRecord = await databaseEngine.getCaseById(caseId);
    if (!caseRecord) {
      throw new Error(`Case not found with ID: ${caseId}`);
    }

    const allEvidence = await databaseEngine.getEvidenceForCase(caseId);
    if (!allEvidence || allEvidence.length === 0) {
      throw new Error(`No evidence items found for case: ${caseId}. Ingest evidence before running analysis.`);
    }

    const targetEvidence = options.evidenceIds && options.evidenceIds.length > 0
      ? allEvidence.filter(e => options.evidenceIds!.includes(e.id))
      : allEvidence;

    if (targetEvidence.length === 0) {
      throw new Error(`None of the specified evidence IDs belong to case: ${caseId}`);
    }

    // ── 2. Build Evidence Context from OCR / Whisper / Metadata ────────────
    notify('CHUNKING', `Compiling extracted evidence context from ${targetEvidence.length} items…`);
    const contextSegments: string[] = [];

    for (const item of targetEvidence) {
      const textParts: string[] = [];
      if (item.ocr_text && item.ocr_text.trim()) {
        textParts.push(`[OCR Extracted Text]:\n"${item.ocr_text.trim()}"`);
      }
      if (item.transcription && item.transcription.trim()) {
        textParts.push(`[Audio Transcription]:\n"${item.transcription.trim()}"`);
      }

      const bodyText = textParts.length > 0
        ? textParts.join('\n\n')
        : '[No extracted text or transcript available for this artifact]';

      const segment = [
        `=== EVIDENCE ITEM: ${item.id} ===`,
        `- Media Type: ${item.media_type}`,
        `- File Path: ${item.file_path}`,
        `- SHA-256 (Import): ${item.sha256_import}`,
        `- Import Timestamp: ${new Date(item.import_ts).toISOString()}`,
        item.exif_ts ? `- EXIF Timestamp: ${new Date(item.exif_ts).toISOString()}` : null,
        `- Content:`,
        bodyText,
        `=== END EVIDENCE ITEM: ${item.id} ===`,
      ].filter(Boolean).join('\n');

      contextSegments.push(segment);
    }

    const fullEvidenceContext = [
      `CASE NUMBER: ${caseRecord.case_number}`,
      `CASE TITLE: ${caseRecord.title}`,
      `CASE DESCRIPTION: ${caseRecord.description || 'N/A'}`,
      `TOTAL EVIDENCE SEGMENTS: ${targetEvidence.length}`,
      '',
      ...contextSegments,
    ].join('\n\n');

    // ── 3. Execute On-Device Gemma LLM Inference ────────────────────────────
    const extractionResult: ForensicExtractionResult = await onDeviceInferenceService.inferForensicExtraction(
      fullEvidenceContext,
      options.onProgress,
      options.timeoutMs ?? 60_000
    );

    if (extractionResult.parseError || !extractionResult.schema) {
      throw new Error(
        `On-device Gemma analysis failed to produce valid forensic JSON: ${extractionResult.parseError || 'Unknown parsing failure'}`
      );
    }

    const schema = extractionResult.schema;

    // ── 4. Persist Results into SQLite ──────────────────────────────────────
    notify('SAVING', 'Persisting extracted facts, events, and actors to SQLite…');

    const persistedEventIds: string[] = [];
    for (const ev of schema.temporalEvents) {
      const eventRecord: EventRecord = await databaseEngine.insertEvent({
        case_id: caseId,
        event_type: ev.eventType,
        severity: ev.severity,
        timestamp: ev.timestamp ? (Date.parse(ev.timestamp) || Date.now()) : Date.now(),
        timestamp_hint: ev.timestamp ?? undefined,
        ai_summary: `[${ev.certainty.toUpperCase()}] ${ev.description}`,
        evidence_ids: ev.sourceEvidenceId ? [ev.sourceEvidenceId] : [targetEvidence[0].id],
        actor_ids: [],
        source: 'system',
      });
      persistedEventIds.push(eventRecord.id);
    }

    const persistedActorIds: string[] = [];
    for (const act of schema.actors) {
      let role: ActorRole = 'unknown';
      if (act.role === 'perpetrator') role = 'offender';
      else if (act.role === 'victim') role = 'victim';
      else if (act.role === 'witness') role = 'bystander';

      const identifiers: ActorIdentifier[] = act.identifiers.map((ident) => ({
        type: 'username',
        value: ident,
        evidence_ids: [targetEvidence[0].id],
        confidence: act.certainty === 'explicit' ? 1.0 : 0.7,
        first_seen: Date.now(),
        last_seen: Date.now(),
      }));

      const actorRecord: ActorRecord = await databaseEngine.insertActor({
        case_id: caseId,
        name: act.name,
        role,
        identifiers,
        confidence: act.certainty === 'explicit' ? 1.0 : 0.7,
        uncertainty_notes: act.certainty === 'inferred' ? ['Model inferred actor role from contextual evidence'] : undefined,
      });
      persistedActorIds.push(actorRecord.id);
    }

    // Persist structured narrative record
    const narrativeContent = [
      `### Incident Summary (${schema.incidentType.toUpperCase()})`,
      schema.incidentSummary,
      '',
      '### Extracted Facts',
      ...schema.extractedFacts.map(f => `- [${f.certainty.toUpperCase()}] (${f.type}): ${f.fact} [Ref: ${f.sourceEvidenceId}]`),
      '',
      schema.threats.length > 0 ? `### Threats Detected\n${schema.threats.map(t => `- ${t}`).join('\n')}\n` : '',
      schema.blackmailIndicators.length > 0 ? `### Blackmail / Extortion Indicators\n${schema.blackmailIndicators.map(b => `- ${b}`).join('\n')}\n` : '',
      schema.coercionIndicators.length > 0 ? `### Coercion Indicators\n${schema.coercionIndicators.map(c => `- ${c}`).join('\n')}\n` : '',
      schema.paymentDemands.length > 0 ? `### Payment / Financial Demands\n${schema.paymentDemands.map(p => `- ${p}`).join('\n')}\n` : '',
      schema.uncertainties.length > 0 ? `### Forensic Uncertainties\n${schema.uncertainties.map(u => `- ${u}`).join('\n')}\n` : '',
    ].filter(Boolean).join('\n');

    const narrativeRecord: NarrativeRecord = await databaseEngine.insertNarrative({
      case_id: caseId,
      content: narrativeContent,
      generated_at: Date.now(),
      events_snapshot: JSON.stringify(persistedEventIds),
      disclaimer: 'This structured forensic extraction was generated locally by Gemma 2B INT4 on-device. Analytical findings distinguish explicit statements from model inferences.',
      parse_error: undefined,
      user_reviewed: false,
      user_edited: false,
    });

    // ── 5. Cryptographic Hash Chain Ledger Recording ────────────────────────
    notify('SAVING', 'Updating cryptographic hash chain ledger…');

    const primaryEvidenceId = targetEvidence[0].id;
    const payloadToHash = `${caseId}:${narrativeRecord.id}:${JSON.stringify(schema)}`;
    const payloadHash = await hashService.computeProcessingHash(payloadToHash);

    const chainNode = await databaseService.appendHashChain(
      primaryEvidenceId,
      'ANALYZE',
      payloadHash
    );

    notify('COMPLETE', 'On-device forensic analysis and ledger recording complete.');
    logger.info(
      `[ForensicAnalysisService] Gemma analysis complete: case=${caseId}, narrative=${narrativeRecord.id}, events=${persistedEventIds.length}, actors=${persistedActorIds.length}, chainNode=${chainNode.id}`
    );

    return {
      caseId,
      schema,
      narrativeRecord,
      persistedEventIds,
      persistedActorIds,
      hashChainNodeId: chainNode.id,
      payloadHash,
      durationMs: extractionResult.durationMs,
      evidenceCount: targetEvidence.length,
    };
  }
}

export const forensicAnalysisService = new ForensicAnalysisService();

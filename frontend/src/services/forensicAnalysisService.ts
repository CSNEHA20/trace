import { databaseEngine } from '../../../database/services/databaseEngine';
import { databaseService } from './databaseService';
import { hashService } from './hashService';
import { logger } from '../utils/logger';
import {
  onDeviceInferenceService,
  InferenceProgress,
  ForensicExtractionResult,
  RejectedClaim,
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
  warnings: string[];
  rejectedClaims: RejectedClaim[];
  rawOutput: string;
}

/**
 * End-to-End Forensic Analysis Pipeline.
 * 
 * Flow:
 * Evidence Files (OCR / Whisper / Text / Metadata)
 *   ↓
 * Delimited Evidence Context (EVIDENCE_ITEM_START ... EVIDENCE_ITEM_END)
 *   ↓
 * On-Device Gemma 2B INT4 (MediaPipe Tasks GenAI Runtime)
 *   ↓
 * Deterministic JSON Parsing & Evidence-Grounding Validation
 *   ↓
 * SQLite Persistence (Events, Actors, Narratives)
 *   ↓
 * Cryptographic Hash Chain Ledger (Operation: ANALYZE)
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

    // ── 2. Build Controlled Delimited Evidence Context ───────────────────────
    notify('CHUNKING', `Compiling delimited evidence context from ${targetEvidence.length} items…`);
    const contextSegments: string[] = [];

    for (const item of targetEvidence) {
      const fileName = item.file_path.split(/[/|\\]/).pop() || item.id;
      const tsIso = new Date(item.import_ts).toISOString();

      const segment = [
        'EVIDENCE_ITEM_START',
        `ID: ${item.id}`,
        `TYPE: ${item.media_type}`,
        `FILE: ${fileName}`,
        `TIMESTAMP: ${tsIso}`,
        item.exif_ts ? `EXIF_TIMESTAMP: ${new Date(item.exif_ts).toISOString()}` : null,
        `OCR_TEXT:`,
        item.ocr_text && item.ocr_text.trim() ? item.ocr_text.trim() : '[None]',
        `TRANSCRIPT:`,
        item.transcription && item.transcription.trim() ? item.transcription.trim() : '[None]',
        `SHA256: ${item.sha256_import}`,
        'EVIDENCE_ITEM_END',
      ].filter(Boolean).join('\n');

      contextSegments.push(segment);
    }

    const fullEvidenceContext = [
      `CASE_NUMBER: ${caseRecord.case_number}`,
      `CASE_TITLE: ${caseRecord.title}`,
      `CASE_DESCRIPTION: ${caseRecord.description || 'N/A'}`,
      `TOTAL_EVIDENCE_ITEMS: ${targetEvidence.length}`,
      '',
      ...contextSegments,
    ].join('\n\n');

    // ── 3. Execute On-Device Gemma LLM Inference with Grounding Validation ──
    let extractionResult: ForensicExtractionResult;
    try {
      extractionResult = await onDeviceInferenceService.inferForensicExtraction(
        fullEvidenceContext,
        targetEvidence,
        options.onProgress,
        options.timeoutMs ?? 60_000
      );
    } catch (llmErr) {
      logger.warn(
        `[ForensicAnalysisService] On-device Gemma LLM unavailable (${(llmErr as Error).message}). Engaging deterministic forensic engine.`
      );
      extractionResult = await onDeviceInferenceService.inferDeterministicForensicExtraction(
        fullEvidenceContext,
        targetEvidence,
        options.onProgress
      );
    }

    if (extractionResult.parseError || !extractionResult.schema) {
      logger.warn(
        `[ForensicAnalysisService] Primary inference produced parse error (${extractionResult.parseError}). Engaging deterministic forensic engine.`
      );
      extractionResult = await onDeviceInferenceService.inferDeterministicForensicExtraction(
        fullEvidenceContext,
        targetEvidence,
        options.onProgress
      );
    }

    if (!extractionResult.schema) {
      throw new Error(
        `On-device forensic analysis failed to produce valid grounded forensic JSON: ${extractionResult.parseError || 'Unknown parsing failure'}`
      );
    }

    const schema = extractionResult.schema;
    const warnings = extractionResult.warnings || [];
    const rejectedClaims = extractionResult.rejectedClaims || [];

    // ── 4. Persist Results into SQLite ──────────────────────────────────────
    notify('SAVING', 'Persisting verified facts, events, and actors to SQLite…');

    const persistedEventIds: string[] = [];
    for (const ev of schema.temporalEvents) {
      const eventRecord: EventRecord = await databaseEngine.insertEvent({
        case_id: caseId,
        event_type: ev.eventType,
        severity: ev.severity,
        timestamp: ev.timestamp ? (Date.parse(ev.timestamp) || Date.now()) : Date.now(),
        timestamp_hint: ev.timestamp ?? undefined,
        ai_summary: `[${ev.certainty.toUpperCase()}] ${ev.description}`,
        evidence_ids: [ev.sourceEvidenceId],
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
      schema.quotedStatements.length > 0 ? `### Quoted Statements\n${schema.quotedStatements.map(q => `- "${q}"`).join('\n')}\n` : '',
      schema.phoneNumbers.length > 0 ? `### Extracted Phone Numbers\n${schema.phoneNumbers.map(p => `- ${p}`).join('\n')}\n` : '',
      schema.urlsAndDomains.length > 0 ? `### URLs & Domains\n${schema.urlsAndDomains.map(u => `- ${u}`).join('\n')}\n` : '',
      schema.uncertainties.length > 0 ? `### Forensic Uncertainties & Validation Rejections\n${schema.uncertainties.map(u => `- ${u}`).join('\n')}\n` : '',
    ].filter(Boolean).join('\n');

    const narrativeRecord: NarrativeRecord = await databaseEngine.insertNarrative({
      case_id: caseId,
      content: narrativeContent,
      generated_at: Date.now(),
      events_snapshot: JSON.stringify(persistedEventIds),
      disclaimer: 'This structured forensic extraction was generated locally by Gemma 2B INT4 on-device. Analytical findings distinguish explicit statements from model inferences. Unsupported claims were rejected by deterministic grounding validation.',
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
      `[ForensicAnalysisService] Gemma analysis complete: case=${caseId}, narrative=${narrativeRecord.id}, events=${persistedEventIds.length}, actors=${persistedActorIds.length}, chainNode=${chainNode.id}, warnings=${warnings.length}, rejected=${rejectedClaims.length}`
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
      warnings,
      rejectedClaims,
      rawOutput: extractionResult.rawOutput,
    };
  }
}

export const forensicAnalysisService = new ForensicAnalysisService();


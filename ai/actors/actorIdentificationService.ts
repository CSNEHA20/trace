import { GEMMA_PROMPTS } from '../prompts/gemmaPrompts';
import { chunkEvidenceText, JsonInferenceResult, parseModelJson } from '../inference/inferenceJson';
import { GEMMA_2B_INT4_SPEC } from '../models/modelConfig';
import { onDeviceInferenceService } from '../inference/inferenceService';
import {
  ActorRecord,
  ActorIdentifier,
  ActorIdentifierType,
  ActorRole,
  EvidenceRecord,
} from '../../frontend/src/types';
import {
  ExtractedActorData,
  extractActorsFromEvidence,
  matchActorsAcrossEvidence,
  mergeActorIdentifiers,
  inferActorRole,
} from './actorIdentification';

export interface ActorIdentificationResult {
  actors: ActorRecord[];
  extracted: ExtractedActorData[];
  matches: { actor_id: string; matched_identifiers: ActorIdentifier[]; confidence: number; match_reason: string }[];
  new_actors: ExtractedActorData[];
  uncertainties: string[];
}

export interface ActorIdentificationOptions {
  inferencer?: {
    inferJson<T>(
      instruction: string,
      evidenceText: string,
      onProgress?: (progress: { stage: string; completedChunks: number; totalChunks: number; message: string }) => void,
      timeoutMs?: number
    ): Promise<JsonInferenceResult<T>[]>;
  };
  onProgress?: (progress: { stage: string; completedChunks: number; totalChunks: number; message: string }) => void;
  existingActors?: ActorRecord[];
  evidence?: EvidenceRecord[];
}

const ACTOR_EXTRACTION_PROMPT = `You are TRACE, an on-device forensic evidence assistant. Extract actors (people/entities) from the supplied evidence text with their identifiers and roles.

For each actor found, provide:
- name: The display name or identifier used in the evidence
- role: One of "victim", "offender", "bystander", "other", "unknown" based on context
- identifiers: List of identifiers with type and value:
  - "username": Social media handles, chat usernames (e.g., @john_doe)
  - "phone_number": Phone numbers in any format
  - "email": Email addresses
  - "display_name": Display names shown in chats
  - "face_detection": Reference to face detection output (e.g., "face_E1_3" for 3 faces in evidence E1)
  - "ai_context": Names or references from AI analysis
- confidence: 0.0 to 1.0 confidence in this actor extraction
- uncertainty_notes: Array of strings noting any uncertainties

Return ONLY valid JSON. Do not use markdown fences. Do not invent facts not in the evidence.
Return format:
{
  "actors": [
    {
      "name": "string",
      "role": "victim|offender|bystander|other|unknown",
      "identifiers": [
        {"type": "username|phone_number|email|display_name|face_detection|ai_context", "value": "string", "confidence": 0.0}
      ],
      "confidence": 0.0,
      "uncertainty_notes": ["string"]
    }
  ]
}`;

export class ActorIdentificationService {
  async identifyActors(
    caseId: string,
    evidence: EvidenceRecord[],
    options: ActorIdentificationOptions = {}
  ): Promise<ActorIdentificationResult> {
    const allUncertainties: string[] = [];
    const allExtracted: ExtractedActorData[] = [];

    for (const ev of evidence) {
      const extracted = extractActorsFromEvidence(ev);
      allExtracted.push(...extracted);
      
      for (const actor of extracted) {
        if (actor.uncertainty_notes) {
          allUncertainties.push(...actor.uncertainty_notes.map(n => `[${ev.id}] ${n}`));
        }
      }
    }

    if (options.inferencer && allExtracted.length > 0) {
      const aiExtracted = await this.extractWithAI(evidence, options);
      allExtracted.push(...aiExtracted);
    }

    const existingActors = options.existingActors || [];
    const { matches, newActors } = matchActorsAcrossEvidence(allExtracted, existingActors);

    const finalActors: ActorRecord[] = [...existingActors];
    const now = Date.now();

    for (const match of matches) {
      const existingActor = finalActors.find(a => a.id === match.actor_id);
      const newActorData = allExtracted.find(
        (na) => na.identifiers.some(
          (nid) => match.matched_identifiers.some(
            (mid) => nid.type === mid.type && nid.value === mid.value
          )
        )
      );
      
      if (existingActor && newActorData) {
        const merged = mergeActorIdentifiers(existingActor, newActorData);
        const role = inferActorRole(merged, evidence);
        finalActors[finalActors.indexOf(existingActor)] = { ...merged, role };
      }
    }

    for (const newActor of newActors) {
      const role = inferActorRole(
        {
          id: '',
          case_id: caseId,
          name: newActor.name,
          role: newActor.role || 'unknown',
          identifiers: newActor.identifiers,
          confidence: newActor.confidence,
          uncertainty_notes: newActor.uncertainty_notes,
          created_at: now,
          updated_at: now,
        } as ActorRecord,
        evidence
      );

      const actorRecord: ActorRecord = {
        id: crypto.randomUUID(),
        case_id: caseId,
        name: newActor.name,
        role,
        identifiers: newActor.identifiers,
        confidence: newActor.confidence,
        uncertainty_notes: newActor.uncertainty_notes,
        created_at: now,
        updated_at: now,
      };
      finalActors.push(actorRecord);
    }

    return {
      actors: finalActors,
      extracted: allExtracted,
      matches,
      new_actors: newActors,
      uncertainties: [...new Set(allUncertainties)],
    };
  }

  private async extractWithAI(
    evidence: EvidenceRecord[],
    options: ActorIdentificationOptions
  ): Promise<ExtractedActorData[]> {
    const text = evidence
      .map((e) => {
        const parts = [];
        if (e.ocr_text) parts.push(`OCR: ${e.ocr_text}`);
        if (e.transcription) parts.push(`TRANSCRIPT: ${e.transcription}`);
        return parts.join('\n');
      })
      .join('\n\n')
      .trim();

    if (!text) return [];

    const inferencer = options.inferencer ?? onDeviceInferenceService;
    const chunks = chunkEvidenceText(text, GEMMA_2B_INT4_SPEC.contextLength);
    
    if (!chunks.length) return [];

    const results = await inferencer.inferJson(
      ACTOR_EXTRACTION_PROMPT,
      text,
      options.onProgress
    );

    const extracted: ExtractedActorData[] = [];

    for (const result of results) {
      if (result.parseError) continue;
      
      const parsed = result.value as { actors?: Array<{
        name: string;
        role: ActorRole;
        identifiers: Array<{ type: ActorIdentifierType; value: string; confidence: number }>;
        confidence: number;
        uncertainty_notes?: string[];
      }> } | undefined;

      if (!parsed?.actors) continue;

      for (const actor of parsed.actors) {
        const identifiers: ActorIdentifier[] = actor.identifiers.map((id) => ({
          type: id.type,
          value: id.value,
          evidence_ids: evidence.map(e => e.id),
          confidence: id.confidence,
          first_seen: Date.now(),
          last_seen: Date.now(),
        }));

        extracted.push({
          name: actor.name,
          role: actor.role,
          identifiers,
          confidence: actor.confidence,
          uncertainty_notes: actor.uncertainty_notes,
          source_evidence_id: evidence[0]?.id || '',
        });
      }
    }

    return extracted;
  }
}

export const actorIdentificationService = new ActorIdentificationService();
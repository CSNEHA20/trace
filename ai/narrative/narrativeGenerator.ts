import { EventRecord } from '../../frontend/src/types';
import { GEMMA_PROMPTS } from '../prompts/gemmaPrompts';
import { chunkEvidenceText, JsonInferenceResult, parseModelJson } from '../inference/inferenceJson';
import { GEMMA_2B_INT4_SPEC } from '../models/modelConfig';
import { onDeviceInferenceService } from '../inference/inferenceService';
import { RECONSTRUCTION_DISCLAIMER } from '../clustering/eventTypes';

export interface NarrativeGenerationResult {
  caseId: string;
  narrative: string;
  generatedAt: number;
  eventsUsed: EventRecord[];
  disclaimer: string;
  parseError?: string;
}

export interface NarrativeOptions {
  inferencer?: {
    inferJson<T>(
      instruction: string,
      evidenceText: string,
      onProgress?: (progress: { stage: string; completedChunks: number; totalChunks: number; message: string }) => void,
      timeoutMs?: number
    ): Promise<JsonInferenceResult<T>[]>;
  };
  onProgress?: (progress: { stage: string; completedChunks: number; totalChunks: number; message: string }) => void;
}

function formatEventsForPrompt(events: EventRecord[]): string {
  const lines: string[] = [];
  for (const event of events) {
    const refs = event.evidence_ids.length ? event.evidence_ids.join(', ') : 'none';
    const hint = event.timestamp_hint ? ` [${event.timestamp_hint}]` : '';
    lines.push(`- ${event.event_type} (severity ${event.severity})${hint}: ${event.ai_summary || 'No summary'} [refs: ${refs}]`);
  }
  return lines.join('\n') || 'No events available.';
}

function groupEventsByType(events: EventRecord[]): Map<string, EventRecord[]> {
  const groups = new Map<string, EventRecord[]>();
  for (const event of events) {
    const type = event.event_type;
    if (!groups.has(type)) groups.set(type, []);
    groups.get(type)!.push(event);
  }
  return groups;
}

function buildNarrativeInput(events: EventRecord[]): string {
  const groups = groupEventsByType(events);
  const sortedEvents = [...events].sort((a, b) => a.timestamp - b.timestamp);
  return [
    'RECONSTRUCTED INCIDENT EVENTS (chronological):',
    formatEventsForPrompt(sortedEvents),
    '',
    'EVENTS BY TYPE:',
    `initial_contact: ${groups.get('initial_contact')?.length || 0}`,
    `threat: ${groups.get('threat')?.length || 0}`,
    `demand: ${groups.get('demand')?.length || 0}`,
    `escalation: ${groups.get('escalation')?.length || 0}`,
    `evidence_sharing: ${groups.get('evidence_sharing')?.length || 0}`,
    `impersonation: ${groups.get('impersonation')?.length || 0}`,
    `other: ${groups.get('other')?.length || 0}`,
  ].join('\n');
}

export class NarrativeGenerator {
  async generateIncidentNarrative(
    caseId: string,
    events: EventRecord[],
    options: NarrativeOptions = {}
  ): Promise<NarrativeGenerationResult> {
    if (!events.length) {
      return {
        caseId,
        narrative: 'No events were reconstructed from the evidence. Unable to generate an incident narrative.',
        generatedAt: Date.now(),
        eventsUsed: [],
        disclaimer: RECONSTRUCTION_DISCLAIMER,
      };
    }

    const narrativeInput = buildNarrativeInput(events);
    const chunksPreview = chunkEvidenceText(narrativeInput, GEMMA_2B_INT4_SPEC.contextLength);

    const inferencer = options.inferencer ?? onDeviceInferenceService;

    try {
      const chunkResults = await inferencer.inferJson(
        GEMMA_PROMPTS.INCIDENT_NARRATIVE,
        narrativeInput,
        options.onProgress
      );

      const combinedNarrative = this.combineNarrativeChunks(chunkResults);
      const parseError = chunkResults.some(r => r.parseError) ? 'One or more chunks had parse errors' : undefined;

      return {
        caseId,
        narrative: combinedNarrative,
        generatedAt: Date.now(),
        eventsUsed: events,
        disclaimer: RECONSTRUCTION_DISCLAIMER,
        parseError,
      };
    } catch (error) {
      throw new Error(`Narrative generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private combineNarrativeChunks(results: JsonInferenceResult[]): string {
    const narratives: string[] = [];
    for (const result of results) {
      if (result.parseError) continue;
      if (result.raw && result.raw.trim()) {
        narratives.push(result.raw.trim());
      }
    }
    return narratives.join('\n\n');
  }
}

export const narrativeGenerator = new NarrativeGenerator();
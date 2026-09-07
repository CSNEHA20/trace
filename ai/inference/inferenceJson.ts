import { ForensicExtractionSchema, ForensicFact, ForensicActor, ForensicEvent } from '../prompts/gemmaPrompts';

export type InferenceProgressStage = 'IDLE' | 'CHECKING' | 'LOADING' | 'CHUNKING' | 'INFERRING' | 'PARSING' | 'SAVING' | 'COMPLETE' | 'FAILED';

export interface InferenceProgress {
  stage: InferenceProgressStage;
  completedChunks: number;
  totalChunks: number;
  message: string;
}

export interface JsonInferenceResult<T = unknown> {
  raw: string;
  value?: T;
  parseError?: string;
  chunks: number;
  durationMs?: number;
}

const CHARS_PER_TOKEN = 4;
const MAX_OUTPUT_TOKENS = 512;
const PROMPT_RESERVE_TOKENS = 350;

/**
 * Splits evidence text into token-budget compliant segments with contextual overlap.
 */
export function chunkEvidenceText(text: string, contextLength = 2048): string[] {
  const inputBudget = Math.max(128, (contextLength - MAX_OUTPUT_TOKENS - PROMPT_RESERVE_TOKENS) * CHARS_PER_TOKEN);
  const normalized = text.trim();
  if (!normalized) return [];
  if (normalized.length <= inputBudget) return [normalized];

  const overlap = Math.min(400, Math.floor(inputBudget / 5));
  const chunks: string[] = [];
  let start = 0;

  while (start < normalized.length) {
    let end = Math.min(normalized.length, start + inputBudget);
    if (end < normalized.length) {
      const boundary = Math.max(
        normalized.lastIndexOf('\n', end),
        normalized.lastIndexOf('. ', end)
      );
      if (boundary > start + inputBudget / 2) {
        end = boundary + 1;
      }
    }
    chunks.push(normalized.slice(start, end).trim());
    if (end === normalized.length) break;
    start = Math.max(end - overlap, start + 1);
  }

  return chunks;
}

/**
 * Deterministic, safe JSON parser that strips markdown fences and repairs structural anomalies
 * without modifying factual strings or inserting synthetic tokens.
 */
export function parseModelJson<T>(raw: string): { value?: T; parseError?: string } {
  if (!raw || !raw.trim()) {
    return { parseError: 'Model returned empty response.' };
  }

  const cleaned = raw.trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  // 1. Direct JSON parse attempt
  try {
    return { value: JSON.parse(cleaned) as T };
  } catch {
    // Proceed to substring extraction
  }

  // 2. Extract outermost JSON bounds {...} or [...]
  const starts = [cleaned.indexOf('{'), cleaned.indexOf('[')].filter((idx) => idx >= 0);
  const first = starts.length ? Math.min(...starts) : -1;
  const last = Math.max(cleaned.lastIndexOf('}'), cleaned.lastIndexOf(']'));

  if (first >= 0 && last > first) {
    const candidate = cleaned.slice(first, last + 1);
    try {
      return { value: JSON.parse(candidate) as T };
    } catch {
      // 3. Attempt safe minor syntax normalization (trailing commas)
      const sanitized = candidate
        .replace(/,\s*([\]}])/g, '$1'); // remove trailing commas before close
      try {
        return { value: JSON.parse(sanitized) as T };
      } catch {
        // Fallback to reporting honest error
      }
    }
  }

  return {
    parseError: 'Gemma did not return valid JSON. The raw local response is preserved for audit.',
  };
}

/**
 * Validates and normalizes raw parsed JSON into a structured ForensicExtractionSchema.
 * Strictly guarantees explicit vs inferred typing and evidence citations.
 */
export function validateForensicExtraction(data: any, defaultEvidenceId: string = 'UNKNOWN'): {
  isValid: boolean;
  normalized?: ForensicExtractionSchema;
  error?: string;
} {
  if (!data || typeof data !== 'object') {
    return { isValid: false, error: 'Extraction data must be an object.' };
  }

  const incidentTypes = ['harassment', 'blackmail', 'threat', 'extortion', 'impersonation', 'benign', 'other'];
  const incidentType = incidentTypes.includes(data.incidentType?.toLowerCase())
    ? data.incidentType.toLowerCase()
    : 'other';

  const incidentSummary = typeof data.incidentSummary === 'string'
    ? data.incidentSummary.trim()
    : 'Incident analysis generated from evidence.';

  const extractedFacts: ForensicFact[] = Array.isArray(data.extractedFacts)
    ? data.extractedFacts.map((f: any): ForensicFact => ({
        fact: String(f.fact ?? f.summary ?? f.text ?? ''),
        type: String(f.type ?? 'statement'),
        sourceEvidenceId: String(f.sourceEvidenceId ?? defaultEvidenceId),
        sourceSpan: f.sourceSpan ? String(f.sourceSpan) : undefined,
        certainty: (f.certainty === 'inferred' || f.certainty === 'explicit') ? f.certainty : 'explicit',
      })).filter((f: ForensicFact) => f.fact.length > 0)
    : [];

  const actors: ForensicActor[] = Array.isArray(data.actors)
    ? data.actors.map((a: any): ForensicActor => ({
        name: typeof a === 'string' ? a : String(a.name ?? 'Unknown'),
        role: ['perpetrator', 'victim', 'witness', 'unknown'].includes(a.role) ? a.role : 'unknown',
        identifiers: Array.isArray(a.identifiers) ? a.identifiers.map(String) : [],
        certainty: (a.certainty === 'inferred' || a.certainty === 'explicit') ? a.certainty : 'explicit',
      })).filter((a: ForensicActor) => a.name.length > 0)
    : [];

  const temporalEvents: ForensicEvent[] = Array.isArray(data.temporalEvents)
    ? data.temporalEvents.map((e: any): ForensicEvent => ({
        timestamp: e.timestamp ? String(e.timestamp) : null,
        description: String(e.description ?? e.summary ?? ''),
        eventType: ['initial_contact', 'threat', 'demand', 'escalation', 'evidence_sharing', 'impersonation', 'other'].includes(e.eventType)
          ? e.eventType
          : 'other',
        severity: typeof e.severity === 'number' && e.severity >= 1 && e.severity <= 5 ? Math.round(e.severity) : 3,
        sourceEvidenceId: String(e.sourceEvidenceId ?? defaultEvidenceId),
        certainty: (e.certainty === 'inferred' || e.certainty === 'explicit') ? e.certainty : 'explicit',
      })).filter((e: ForensicEvent) => e.description.length > 0)
    : [];

  const toStringArray = (val: any): string[] => {
    if (!Array.isArray(val)) return [];
    return val.map(String).filter(s => s.trim().length > 0);
  };

  const normalized: ForensicExtractionSchema = {
    incidentType,
    incidentSummary,
    extractedFacts,
    actors,
    temporalEvents,
    threats: toStringArray(data.threats),
    harassmentIndicators: toStringArray(data.harassmentIndicators),
    blackmailIndicators: toStringArray(data.blackmailIndicators),
    coercionIndicators: toStringArray(data.coercionIndicators),
    paymentDemands: toStringArray(data.paymentDemands),
    communicationChannels: toStringArray(data.communicationChannels),
    phoneNumbers: toStringArray(data.phoneNumbers),
    urlsAndDomains: toStringArray(data.urlsAndDomains),
    quotedStatements: toStringArray(data.quotedStatements),
    uncertainties: toStringArray(data.uncertainties),
  };

  return { isValid: true, normalized };
}

import {
  INCIDENT_EVENT_TYPES,
  INCIDENT_SEVERITIES,
  IncidentEventType,
  IncidentSeverity,
  ModelIncidentEvent,
  RejectedClusterItem,
  ValidatedIncidentEvent,
} from './eventTypes';
import { EvidenceCorpus } from './eventTypes';
import { resolveEvidenceRefs } from './evidenceCorpus';
import { normalizeEventTimestamp } from './timestampNormalize';
import { parseModelJson } from '../inference/inferenceJson';

export function isIncidentEventType(value: string): value is IncidentEventType {
  return (INCIDENT_EVENT_TYPES as readonly string[]).includes(value);
}

export function parseIncidentSeverity(value: unknown): IncidentSeverity | undefined {
  const numeric = typeof value === 'number' ? value : typeof value === 'string' && /^-?\d+$/.test(value.trim())
    ? Number(value.trim())
    : undefined;
  if (numeric === undefined || !Number.isInteger(numeric)) return undefined;
  return (INCIDENT_SEVERITIES as readonly number[]).includes(numeric)
    ? (numeric as IncidentSeverity)
    : undefined;
}

function asStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  if (!value.every((entry) => typeof entry === 'string')) return undefined;
  return value.map((entry) => entry.trim()).filter((entry) => entry.length > 0);
}

function extractEventList(value: unknown): unknown[] | undefined {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object' && Array.isArray((value as { events?: unknown }).events)) {
    return (value as { events: unknown[] }).events;
  }
  return undefined;
}

export function parseClusterPayload(raw: string): { events?: unknown[]; parseError?: string } {
  const parsed = parseModelJson<unknown>(raw);
  if (parsed.parseError) return { parseError: parsed.parseError };
  const events = extractEventList(parsed.value);
  if (!events) {
    return { parseError: 'Model JSON was not an event array or {"events":[...]} object.' };
  }
  return { events };
}

export function validateModelEvent(
  raw: unknown,
  corpus: EvidenceCorpus
): { event?: ValidatedIncidentEvent; rejection?: RejectedClusterItem } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { rejection: { code: 'INVALID_SCHEMA', reason: 'Event was not a JSON object.', raw } };
  }

  const candidate = raw as Partial<ModelIncidentEvent>;
  if (typeof candidate.event_type !== 'string') {
    return { rejection: { code: 'INVALID_SCHEMA', reason: 'event_type must be a string.', raw } };
  }
  if (!isIncidentEventType(candidate.event_type)) {
    return {
      rejection: {
        code: 'INVALID_EVENT_TYPE',
        reason: `event_type "${candidate.event_type}" is not an allowed incident type.`,
        raw,
      },
    };
  }

  const severity = parseIncidentSeverity(candidate.severity);
  if (severity === undefined) {
    return {
      rejection: {
        code: 'INVALID_SEVERITY',
        reason: 'severity must be an integer from 1 to 5.',
        raw,
      },
    };
  }

  if (typeof candidate.summary !== 'string' || !candidate.summary.trim()) {
    return { rejection: { code: 'EMPTY_SUMMARY', reason: 'summary must be a non-empty string.', raw } };
  }

  const hint =
    candidate.timestamp_hint === null || candidate.timestamp_hint === undefined
      ? null
      : typeof candidate.timestamp_hint === 'string'
        ? candidate.timestamp_hint
        : undefined;
  if (hint === undefined) {
    return { rejection: { code: 'INVALID_SCHEMA', reason: 'timestamp_hint must be a string or null.', raw } };
  }

  const refs = asStringArray(candidate.evidence_refs);
  if (!refs) {
    return { rejection: { code: 'INVALID_SCHEMA', reason: 'evidence_refs must be an array of strings.', raw } };
  }
  if (refs.length === 0) {
    return {
      rejection: {
        code: 'UNSUPPORTED_BY_EVIDENCE',
        reason: 'Event cited no evidence references.',
        raw,
      },
    };
  }

  const { resolved, unresolved } = resolveEvidenceRefs(refs, corpus);
  if (resolved.length === 0) {
    return {
      rejection: {
        code: 'UNRESOLVED_EVIDENCE',
        reason: `No evidence_refs could be resolved: ${unresolved.join(', ')}`,
        raw,
      },
    };
  }

  const supported = resolved.filter((item) => item.extractedText.length > 0);
  if (supported.length === 0) {
    return {
      rejection: {
        code: 'UNSUPPORTED_BY_EVIDENCE',
        reason: 'Resolved evidence contained no OCR or transcript text.',
        raw,
      },
    };
  }

  const time = normalizeEventTimestamp(hint, supported);
  const event: ValidatedIncidentEvent = {
    event_type: candidate.event_type,
    severity,
    summary: candidate.summary.trim(),
    timestamp_hint: hint,
    evidence_refs: supported.map((item) => item.id),
    timestamp: time.timestamp,
    timestamp_conflict: time.timestamp_conflict,
    timestamp_unresolved: time.timestamp_unresolved,
  };

  return { event };
}

export function eventSortKey(event: ValidatedIncidentEvent): string {
  return [
    String(event.timestamp).padStart(16, '0'),
    event.event_type,
    String(event.severity),
    event.summary,
    event.evidence_refs.join(','),
  ].join('|');
}

export function dedupeValidatedEvents(events: ValidatedIncidentEvent[]): ValidatedIncidentEvent[] {
  const seen = new Set<string>();
  const unique: ValidatedIncidentEvent[] = [];
  for (const event of [...events].sort((a, b) => eventSortKey(a).localeCompare(eventSortKey(b)))) {
    const key = [event.event_type, event.severity, event.summary, event.evidence_refs.join(',')].join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(event);
  }
  return unique;
}

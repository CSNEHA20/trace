export const INCIDENT_EVENT_TYPES = [
  'initial_contact',
  'threat',
  'demand',
  'escalation',
  'evidence_sharing',
  'impersonation',
  'other',
] as const;

export type IncidentEventType = (typeof INCIDENT_EVENT_TYPES)[number];

export const INCIDENT_SEVERITIES = [1, 2, 3, 4, 5] as const;
export type IncidentSeverity = (typeof INCIDENT_SEVERITIES)[number];

export const RECONSTRUCTION_DISCLAIMER =
  'AI output is an analytical reconstruction from extracted evidence text, not unquestionable truth. Investigators must review, edit, and annotate events before relying on them.';

export interface ModelIncidentEvent {
  event_type: string;
  severity: unknown;
  summary: string;
  timestamp_hint: string | null;
  evidence_refs: unknown;
}

export interface ValidatedIncidentEvent {
  event_type: IncidentEventType;
  severity: IncidentSeverity;
  summary: string;
  timestamp_hint: string | null;
  evidence_refs: string[];
  timestamp: number;
  timestamp_conflict: boolean;
  timestamp_unresolved: boolean;
}

export interface RejectedClusterItem {
  reason: string;
  code:
    | 'MALFORMED_JSON'
    | 'INVALID_SCHEMA'
    | 'INVALID_EVENT_TYPE'
    | 'INVALID_SEVERITY'
    | 'EMPTY_SUMMARY'
    | 'UNRESOLVED_EVIDENCE'
    | 'UNSUPPORTED_BY_EVIDENCE'
    | 'INVENTED_CONTENT';
  raw?: unknown;
}

export interface EvidenceCorpusItem {
  id: string;
  index: number;
  token: string;
  fileName: string;
  mediaType: string;
  importTs: number;
  exifTs?: number;
  userTs?: number;
  ocrText: string;
  transcription: string;
  extractedText: string;
}

export interface EvidenceCorpus {
  caseId: string;
  items: EvidenceCorpusItem[];
  catalogText: string;
  bodyText: string;
  combinedText: string;
}

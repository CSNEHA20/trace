export type VictimDisplayMode = 'anonymized' | 'named';

export type ReportFormat = 'PDF' | 'HTML' | 'TXT';

export interface IncidentReportOptions {
  includeOCR: boolean;
  includeThumbnails: boolean;
  anonymizeVictim: boolean;
  victimDisplayMode: VictimDisplayMode;
  includeAiNarrative: boolean;
  includeEventLog: boolean;
  includeEvidenceInventory: boolean;
  includeHashChain: boolean;
  includeAppendix: boolean;
  agencyName: string;
  investigatorNotes?: string;
  reportFormat: ReportFormat;
}

export interface IncidentReportMetadata {
  reportId: string;
  caseId: string;
  caseNumber: string;
  caseTitle: string;
  generatedAt: number;
  generatedBy: string;
  victimIdentifier: string;
  incidentDateRange: { start: number; end: number } | null;
  evidenceCount: number;
  eventCount: number;
  hashManifest: string;
  manifestHash?: string;
  options: IncidentReportOptions;
  format: ReportFormat;
  fileSize?: number;
  fileUri?: string;
}

export interface CoverPageData {
  victimIdentifier: string;
  victimDisplayMode: VictimDisplayMode;
  incidentDateRange: { start: number; end: number } | null;
  caseReference: string;
  agencyName: string;
  investigatorName: string;
  generatedAt: number;
}

export interface AiIncidentNarrative {
  id: string;
  caseId: string;
  content: string;
  generatedAt: number;
  eventsSnapshot: string[];
  disclaimer: string;
  userReviewed: boolean;
  userEdited: boolean;
}

export interface EventLogEntry {
  timestamp: number;
  event: string;
  severity: 1 | 2 | 3 | 4 | 5;
  severityLabel: string;
  evidenceReferences: string[];
  aiSummary?: string;
  source: 'ai' | 'user' | 'system';
}

export interface EvidenceInventoryItem {
  filename: string;
  type: string;
  importDate: number;
  sha256: string;
  fileSize: number;
  mimeType: string;
  originalFilename?: string;
  thumbnailUri?: string;
  ocrText?: string;
}

export interface HashChainEntry {
  id: string;
  evidenceId: string;
  operation: string;
  payloadHash: string;
  chainHash: string;
  timestamp: number;
}

export interface AppendixItem {
  evidenceId: string;
  filename: string;
  type: string;
  thumbnailUri?: string;
  isRedacted: boolean;
  redactionReason?: string;
}

export interface CompleteIncidentReport {
  metadata: IncidentReportMetadata;
  coverPage: CoverPageData;
  aiNarrative: AiIncidentNarrative | null;
  eventLog: EventLogEntry[];
  evidenceInventory: EvidenceInventoryItem[];
  hashChain: HashChainEntry[];
  appendix: AppendixItem[];
}

export interface IncidentReportGenerationResult {
  success: boolean;
  reportId?: string;
  pdfUri?: string;
  htmlContent?: string;
  metadata?: IncidentReportMetadata;
  error?: string;
}

export const DEFAULT_INCIDENT_REPORT_OPTIONS: IncidentReportOptions = {
  includeOCR: true,
  includeThumbnails: true,
  anonymizeVictim: true,
  victimDisplayMode: 'anonymized',
  includeAiNarrative: true,
  includeEventLog: true,
  includeEvidenceInventory: true,
  includeHashChain: true,
  includeAppendix: true,
  agencyName: 'TRACE Digital Forensics Unit',
  reportFormat: 'PDF',
};
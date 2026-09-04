/**
 * TRACE System-wide Type Definitions & Interfaces
 */

export type CaseStatus = 'ACTIVE' | 'ARCHIVED' | 'CLOSED' | 'UNDER_REVIEW';

export type EvidenceType = 'IMAGE' | 'AUDIO' | 'VIDEO' | 'DOCUMENT';

export type HashAlgorithm = 'SHA-256' | 'SHA-512';

export interface ExifMetadata {
  make?: string;
  model?: string;
  dateTimeOriginal?: string;
  gpsLatitude?: number;
  gpsLongitude?: number;
  gpsAltitude?: number;
  software?: string;
  orientation?: number;
  rawExif?: Record<string, unknown>;
}

export interface AiAnalysisResult {
  gemmaSummary?: string;
  detectedText?: string[];
  facesCount?: number;
  transcription?: string;
  tags?: string[];
  confidenceScore?: number;
  processedAt?: number;
}

export interface EvidenceItem {
  id: string;
  caseId: string;
  title: string;
  description?: string;
  type: EvidenceType;
  fileUri: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  sha256Hash: string;
  signature: string;
  timestamp: number;
  exifData?: ExifMetadata;
  aiAnalysis?: AiAnalysisResult;
  isTampered?: boolean;
  tamperReason?: string;
}

export interface Case {
  id: string;
  caseNumber: string;
  title: string;
  description?: string;
  investigatorName: string;
  status: CaseStatus;
  createdAt: number;
  updatedAt: number;
  evidenceIds: string[];
}

export interface TimelineEvent {
  id: string;
  caseId: string;
  evidenceId?: string;
  timestamp: number;
  title: string;
  description: string;
  category: 'CAPTURE' | 'ANALYSIS' | 'EXPORT' | 'SYSTEM' | 'TAMPER_ALERT';
  actor?: string;
  metadata?: Record<string, unknown>;
}

export interface AuditLog {
  id: string;
  timestamp: number;
  action: string;
  entityId: string;
  entityType: 'CASE' | 'EVIDENCE' | 'SYSTEM';
  details: string;
  hash: string;
}

export interface AppConfig {
  appName: string;
  version: string;
  buildNumber: string;
  hashAlgorithm: HashAlgorithm;
  autoAnalyzeOnCapture: boolean;
  storageLimitMb: number;
  themeMode: 'dark' | 'light' | 'system';
  offlineOnly: boolean;
}

export interface ServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  errorCode?: string;
}

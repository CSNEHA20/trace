/**
 * TRACE System-wide Type Definitions & Database Models
 */

export type CaseStatus = 'ACTIVE' | 'ARCHIVED' | 'CLOSED' | 'UNDER_REVIEW';

export type MediaCategory = 'IMAGE' | 'AUDIO' | 'VIDEO' | 'DOCUMENT';
export type EvidenceType = MediaCategory;

export type EventSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

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

// --------------------------------------------------
// STEP 3 DATABASE TABLE MODELS
// --------------------------------------------------

export interface CaseRecord {
  id: string;
  case_number: string;
  title: string;
  description?: string;
  investigator_name: string;
  status: CaseStatus;
  created_at: number;
  updated_at: number;
}

export interface EvidenceRecord {
  id: string;
  case_id: string;
  file_path: string;
  media_type: MediaCategory;
  import_ts: number;
  exif_ts?: number;
  user_ts?: number;
  ocr_text?: string;
  transcription?: string;
  sha256_import: string;
  sha256_processed?: string;
}

export interface EventRecord {
  id: string;
  case_id: string;
  event_type: string;
  severity: EventSeverity;
  timestamp: number;
  ai_summary?: string;
  evidence_ids: string[]; // Stored as JSON stringified array in SQLite
  actor_ids: string[];    // Stored as JSON stringified array in SQLite
}

export interface ActorRecord {
  id: string;
  case_id: string;
  name: string;
  role: string;
  contact_info?: string;
  created_at: number;
}

export interface HashChainRecord {
  id: string;
  evidence_id: string;
  operation: string;
  payload_hash: string;
  chain_hash: string;
  timestamp: number;
}

export interface SchemaMigrationRecord {
  version: number;
  name: string;
  applied_at: number;
}

// Legacy UI Type Wrappers
export interface EvidenceItem {
  id: string;
  caseId: string;
  title: string;
  description?: string;
  type: MediaCategory;
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
  category: string;
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
  hashAlgorithm: 'SHA-256' | 'SHA-512';
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

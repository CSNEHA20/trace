/**
 * TRACE System-wide Type Definitions & Database Models
 */

export type CaseStatus = 'ACTIVE' | 'ARCHIVED' | 'CLOSED' | 'UNDER_REVIEW';

export type MediaCategory = 'IMAGE' | 'AUDIO' | 'VIDEO' | 'DOCUMENT';
export type EvidenceType = MediaCategory;

// --------------------------------------------------
// STEP 4 — EVIDENCE INGESTION TYPES
// --------------------------------------------------

/**
 * Lifecycle states of a single evidence ingestion attempt.
 * Transitions: PENDING → COPYING → HASHING → RECORDING → COMPLETE
 *             or any stage → FAILED | DUPLICATE | CANCELLED
 */
export type IngestionStatus =
  | 'PENDING'
  | 'COPYING'
  | 'HASHING'
  | 'RECORDING'
  | 'COMPLETE'
  | 'FAILED'
  | 'DUPLICATE'
  | 'CANCELLED';

/** Source from which evidence was imported */
export type IngestionSource = 'CAMERA' | 'GALLERY' | 'FILES' | 'CLIPBOARD';

/** Result returned by the ingestion pipeline */
export interface IngestionResult {
  status: IngestionStatus;
  evidenceId?: string;
  sha256?: string;
  sandboxUri?: string;
  originalFilename?: string;
  mediaType?: MediaCategory;
  fileSize?: number;
  importTs?: number;
  duplicateOf?: string; // evidence id of existing duplicate
  error?: string;
  errorCode?: IngestionErrorCode;
}

/** Typed error codes for specific failure modes */
export type IngestionErrorCode =
  | 'PERMISSION_DENIED'
  | 'UNSUPPORTED_FORMAT'
  | 'CORRUPTED_FILE'
  | 'INSUFFICIENT_STORAGE'
  | 'FILE_TOO_LARGE'
  | 'COPY_FAILED'
  | 'HASH_FAILED'
  | 'DB_ERROR'
  | 'CANCELLED'
  | 'UNKNOWN';

/** Resolved media type info from MIME and extension */
export interface MediaTypeDetection {
  mediaCategory: MediaCategory;
  mimeType: string;
  extension: string;
  isSupported: boolean;
  rejectionReason?: string;
}

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
  // Step 4 extensions (backward-compatible — all optional)
  original_filename?: string;
  file_size?: number;
  ingestion_status?: IngestionStatus;
  processing_note?: string;
  ingestion_source?: IngestionSource;
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

// --------------------------------------------------
// STEP 5 — FORENSIC REPORT GENERATION TYPES
// --------------------------------------------------

export type ReportExportStatus =
  | 'IDLE'
  | 'GENERATING_HTML'
  | 'CREATING_PDF'
  | 'SIGNING'
  | 'SAVING'
  | 'COMPLETE'
  | 'FAILED';

export interface ReportOptions {
  includeAiSummaries: boolean;
  includeExifMetadata: boolean;
  includeHashChain: boolean;
  includeThumbnails: boolean;
  agencyName: string;
  investigatorNotes?: string;
}

export interface ReportEvidenceSummary {
  id: string;
  fileName: string;
  mediaType: MediaCategory;
  fileSize: number;
  sha256Hash: string;
  signature: string;
  importTs: number;
  isTampered: boolean;
  tamperReason?: string;
  exifMakeModel?: string;
  ocrSnippet?: string;
  transcriptionSnippet?: string;
  gemmaSummary?: string;
}

export interface ForensicReportManifest {
  reportId: string;
  caseId: string;
  caseNumber: string;
  caseTitle: string;
  investigatorName: string;
  agencyName: string;
  generatedAt: number;
  evidenceCount: number;
  tamperedEvidenceCount: number;
  evidenceItems: ReportEvidenceSummary[];
  investigatorNotes?: string;
  manifestHash: string;
  digitalSignature: string;
  pdfUri?: string;
  htmlContent?: string;
}

export interface ExportPackageResult {
  pdfUri: string;
  zipUri: string;
  manifestHash: string;
  digitalSignature: string;
  exportedAt: number;
  htmlContent?: string;
}

// --------------------------------------------------
// STEP 7 — AUDIO TRANSCRIPTION TYPES
// --------------------------------------------------

export type TranscriptionStatus =
  | 'IDLE'
  | 'LOADING_MODEL'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

export type TranscriptionErrorCode =
  | 'FILE_NOT_FOUND'
  | 'UNSUPPORTED_CODEC'
  | 'SILENCE_DETECTED'
  | 'POOR_QUALITY'
  | 'LONG_RECORDING'
  | 'MODEL_ERROR'
  | 'TRANSCRIPTION_FAILED'
  | 'CANCELLED'
  | 'UNKNOWN';

export type WhisperModelType = 'tiny' | 'base';

export interface TranscriptionOptions {
  model?: WhisperModelType;
  language?: string;
  onProgress?: (progress: number, statusText: string) => void;
  cancellationSignal?: { isCancelled: boolean };
}

export interface TranscriptionResult {
  status: TranscriptionStatus;
  text?: string;
  language?: string;
  durationSeconds?: number;
  confidence?: number;
  processingHash?: string;
  chainNodeId?: string;
  error?: string;
  errorCode?: TranscriptionErrorCode;
}


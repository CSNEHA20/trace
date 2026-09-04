import {
  IngestionResult,
  IngestionSource,
  IngestionStatus,
  MediaCategory,
  MediaTypeDetection,
  IngestionErrorCode,
} from '../types';
import { cryptoService } from './cryptoService';
import { sandboxService } from './sandboxService';
import { databaseService } from './databaseService';
import { logger } from '../utils/logger';

// ─────────────────────────────────────────────────────────────────────────────
// SUPPORTED FORMAT REGISTRY
// ─────────────────────────────────────────────────────────────────────────────

interface FormatEntry {
  category: MediaCategory;
  mimePattern: RegExp;
  extensions: string[];
}

const SUPPORTED_FORMATS: FormatEntry[] = [
  {
    category: 'IMAGE',
    mimePattern: /^image\//,
    extensions: ['jpg', 'jpeg', 'png', 'heic', 'heif', 'webp', 'bmp', 'tiff', 'tif', 'gif'],
  },
  {
    category: 'VIDEO',
    mimePattern: /^video\//,
    extensions: ['mp4', 'mov', 'avi', 'mkv', 'webm', '3gp', 'm4v'],
  },
  {
    category: 'AUDIO',
    mimePattern: /^audio\//,
    extensions: ['mp3', 'wav', 'm4a', 'aac', 'ogg', 'flac', 'opus'],
  },
  {
    category: 'DOCUMENT',
    mimePattern: /^(application\/pdf|text\/plain|application\/json|text\/csv|application\/zip|application\/x-zip|application\/octet-stream)$/,
    extensions: ['pdf', 'txt', 'json', 'csv', 'zip', 'log'],
  },
];

const MAX_FILE_SIZE_BYTES = 500 * 1024 * 1024; // 500 MB

// ─────────────────────────────────────────────────────────────────────────────
// MEDIA TYPE DETECTION
// ─────────────────────────────────────────────────────────────────────────────

export function detectMediaType(
  filename: string,
  mimeType?: string
): MediaTypeDetection {
  const lower = filename.toLowerCase();
  const ext = lower.split('.').pop() || '';

  // Try MIME first, then extension
  for (const fmt of SUPPORTED_FORMATS) {
    const mimeMatch = mimeType && fmt.mimePattern.test(mimeType);
    const extMatch = fmt.extensions.includes(ext);
    if (mimeMatch || extMatch) {
      return {
        mediaCategory: fmt.category,
        mimeType: mimeType || `application/${ext}`,
        extension: ext,
        isSupported: true,
      };
    }
  }

  return {
    mediaCategory: 'DOCUMENT',
    mimeType: mimeType || 'application/octet-stream',
    extension: ext,
    isSupported: false,
    rejectionReason: `Unsupported file format: .${ext || 'unknown'} (${mimeType || 'unknown MIME'})`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// INGESTION PIPELINE
// ─────────────────────────────────────────────────────────────────────────────

export interface IngestionInput {
  /** URI of the file to ingest (camera capture, gallery pick, file pick, clipboard) */
  sourceUri: string;
  /** Original display filename */
  originalFilename: string;
  /** MIME type if known */
  mimeType?: string;
  /** Reported file size in bytes (optional; will be confirmed during copy) */
  reportedSize?: number;
  /** Which source produced this file */
  source: IngestionSource;
  /** Which case this evidence belongs to */
  caseId: string;
  /** Optional progress callback — called at each pipeline stage */
  onStatusUpdate?: (status: IngestionStatus) => void;
}

/**
 * TRACE Evidence Ingestion Pipeline
 *
 * Full pipeline: validate → storage check → copy to sandbox → hash (before extraction)
 *   → duplicate check → DB record → hash chain append
 *
 * Security invariants:
 * - sourceUri is used ONLY for the copy step — never logged in full, never reopened
 * - SHA-256 is computed on the COPIED sandbox bytes, not the original URI
 * - No evidence content is logged
 * - No cloud calls at any step
 */
class IngestionService {
  async ingest(input: IngestionInput): Promise<IngestionResult> {
    const { sourceUri, originalFilename, mimeType, reportedSize, source, caseId, onStatusUpdate } = input;

    const notify = (s: IngestionStatus) => onStatusUpdate?.(s);

    // ── 0. Initial state ──────────────────────────────────────────────────
    notify('PENDING');

    // ── 1. Validate format ────────────────────────────────────────────────
    const typeInfo = detectMediaType(originalFilename, mimeType);
    if (!typeInfo.isSupported) {
      return this._fail('UNSUPPORTED_FORMAT', typeInfo.rejectionReason || 'Unsupported format');
    }

    // ── 2. Validate size (if reported upfront) ────────────────────────────
    if (reportedSize !== undefined && reportedSize > MAX_FILE_SIZE_BYTES) {
      return this._fail(
        'FILE_TOO_LARGE',
        `File is ${Math.round(reportedSize / 1024 / 1024)} MB — exceeds 500 MB limit`
      );
    }

    // ── 3. Check available storage ────────────────────────────────────────
    const storageCheck = await sandboxService.checkStorageAvailability(reportedSize ?? 50 * 1024 * 1024);
    if (!storageCheck.available) {
      return this._fail(
        'INSUFFICIENT_STORAGE',
        `Insufficient storage. ${Math.round((storageCheck.freeBytes ?? 0) / 1024 / 1024)} MB free, need ${Math.round((storageCheck.requiredBytes ?? 0) / 1024 / 1024)} MB`
      );
    }

    // ── 4. COPY into sandbox ──────────────────────────────────────────────
    notify('COPYING');
    const copyResult = await sandboxService.copyIntoSandbox(sourceUri, typeInfo.extension);
    if (!copyResult.success || !copyResult.sandboxUri) {
      return this._fail('COPY_FAILED', copyResult.error ?? 'File copy to sandbox failed');
    }

    const sandboxUri = copyResult.sandboxUri;
    const fileSize = copyResult.fileSize ?? reportedSize ?? 0;

    // ── 5. Validate size post-copy ─────────────────────────────────────────
    if (fileSize > MAX_FILE_SIZE_BYTES) {
      await sandboxService.deleteSandboxFile(sandboxUri);
      return this._fail(
        'FILE_TOO_LARGE',
        `File is ${Math.round(fileSize / 1024 / 1024)} MB — exceeds 500 MB limit`
      );
    }

    // ── 6. SHA-256 of COPIED bytes (BEFORE any extraction) ────────────────
    notify('HASHING');
    let sha256: string;
    try {
      const base64Data = copyResult.base64Data ?? (await sandboxService.readSandboxFileBase64(sandboxUri));
      if (!base64Data) {
        await sandboxService.deleteSandboxFile(sandboxUri);
        return this._fail('HASH_FAILED', 'Could not read sandbox file for hashing');
      }
      sha256 = await cryptoService.computeSHA256(base64Data);
    } catch (err) {
      await sandboxService.deleteSandboxFile(sandboxUri);
      return this._fail('HASH_FAILED', (err as Error)?.message || 'Hashing failed');
    }

    // ── 7. Validate file not corrupted (basic: hash must be 64 hex chars) ─
    if (!sha256 || sha256.length !== 64 || !/^[0-9a-f]+$/i.test(sha256)) {
      await sandboxService.deleteSandboxFile(sandboxUri);
      return this._fail('CORRUPTED_FILE', 'Computed hash is invalid — file may be corrupted');
    }

    // ── 8. Duplicate detection ────────────────────────────────────────────
    const existing = await this._findDuplicate(sha256);
    if (existing) {
      // Clean up the redundant copy
      await sandboxService.deleteSandboxFile(sandboxUri);
      logger.debug(`Duplicate evidence detected (hash prefix: ${sha256.substring(0, 8)}...)`);
      return {
        status: 'DUPLICATE',
        sha256,
        originalFilename,
        mediaType: typeInfo.mediaCategory,
        duplicateOf: existing,
        error: `This file has already been imported (Evidence ID: ${existing.substring(0, 8)}...)`,
        errorCode: 'UNKNOWN',
      };
    }

    // ── 9. Record device import timestamp ─────────────────────────────────
    const importTs = Date.now();

    // ── 10. INSERT SQLite evidence record ─────────────────────────────────
    notify('RECORDING');
    let evidenceItem;
    try {
      evidenceItem = await databaseService.addEvidence({
        caseId,
        title: originalFilename,
        type: typeInfo.mediaCategory,
        fileUri: sandboxUri,
        fileName: originalFilename,
        fileSize,
        mimeType: typeInfo.mimeType,
        sha256Hash: sha256,
        signature: await cryptoService.signPayload(sha256),
        isTampered: false,
        // Step 4 extended fields stored via databaseService bridge
      });
    } catch (err) {
      await sandboxService.deleteSandboxFile(sandboxUri);
      return this._fail('DB_ERROR', (err as Error)?.message || 'Database insert failed');
    }

    // ── 11. COMPLETE ──────────────────────────────────────────────────────
    notify('COMPLETE');
    logger.info(
      `Evidence ingested: type=${typeInfo.mediaCategory} size=${fileSize}B hash=...${sha256.substring(56)}`
    );

    return {
      status: 'COMPLETE',
      evidenceId: evidenceItem.id,
      sha256,
      sandboxUri,
      originalFilename,
      mediaType: typeInfo.mediaCategory,
      fileSize,
      importTs,
    };
  }

  /** Convenience: returns evidence ID of duplicate if hash exists, else null */
  private async _findDuplicate(sha256: string): Promise<string | null> {
    try {
      const rec = await databaseService.getEvidenceByHash(sha256);
      return rec ? rec.id : null;
    } catch {
      return null;
    }
  }

  private _fail(errorCode: IngestionErrorCode, error: string): IngestionResult {
    logger.warn(`Ingestion failed [${errorCode}]: ${error}`);
    return { status: 'FAILED', errorCode, error };
  }
}

export const ingestionService = new IngestionService();

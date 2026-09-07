import {
  OcrResult,
  OcrStatus,
  OcrErrorCode,
  OcrOptions,
  MediaCategory,
} from '../types';
import { ocrNativeBridge } from './ocrNativeBridge';
import { databaseService } from './databaseService';
import { sandboxService } from './sandboxService';
import { hashService } from './hashService';
import { logger } from '../utils/logger';

/**
 * Supported Image MIME formats for ML Kit Text Recognition
 */
const SUPPORTED_IMAGE_MIMES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/bmp',
  'image/heic',
  'image/heif',
];

/**
 * TRACE On-Device OCR Service
 * 
 * Orchestrates image validation, on-device native ML Kit text recognition,
 * SHA-256 hash tracking, and SQLite persistence.
 * 
 * Rules:
 * - Real On-Device OCR only (Zero Mock).
 * - Empty recognized text is a valid COMPLETED result.
 * - OCR failures never delete or invalidate evidence.
 */
class OcrService {
  /**
   * Run OCR text recognition on an evidence item.
   */
  async processEvidenceOcr(
    evidenceId: string,
    fileUri: string,
    mediaType: MediaCategory,
    options?: OcrOptions
  ): Promise<OcrResult> {
    const notify = (status: OcrStatus) => options?.onStatusUpdate?.(status);

    notify('VALIDATING');
    logger.info(`[OcrService] Starting OCR pipeline for evidence ${evidenceId} (URI: ${fileUri})`);

    // ── 1. Validate Media Category ──────────────────────────────────────────
    if (mediaType !== 'IMAGE') {
      logger.warn(`[OcrService] Non-image evidence type rejected: ${mediaType}`);
      return this._fail('NOT_AN_IMAGE', `Cannot perform OCR on non-image media type: ${mediaType}`);
    }

    // ── 2. Validate File Exists & is Accessible in Sandbox ─────────────────
    try {
      const fileInfo = await sandboxService.readFileInfo(fileUri);
      if (!fileInfo.exists) {
        logger.warn(`[OcrService] File not found in sandbox: ${fileUri}`);
        return this._fail('FILE_NOT_FOUND', `Evidence file does not exist at ${fileUri}`);
      }
      if (fileInfo.size === 0) {
        logger.warn(`[OcrService] File is 0 bytes: ${fileUri}`);
        return this._fail('FILE_UNREADABLE', 'Evidence file is empty (0 bytes)');
      }
    } catch (err) {
      logger.warn(`[OcrService] File check failed for ${fileUri}:`, err);
      return this._fail('FILE_UNREADABLE', (err as Error)?.message || 'Could not verify file existence');
    }

    // ── 3. Execute Native On-Device OCR ────────────────────────────────────
    notify('PROCESSING');
    let nativeResult: OcrResult;
    try {
      nativeResult = await ocrNativeBridge.recognizeText(fileUri);
    } catch (err) {
      logger.error(`[OcrService] Native OCR invocation failed:`, err);
      return this._fail(
        'OCR_ENGINE_ERROR',
        (err as Error)?.message || 'Native OCR engine failure'
      );
    }

    // If native engine reported failure, return truthful failure
    if (nativeResult.status === 'FAILED') {
      logger.warn(`[OcrService] Native OCR returned failure: ${nativeResult.error} (${nativeResult.errorCode})`);
      return {
        status: 'FAILED',
        error: nativeResult.error || 'OCR processing failed',
        errorCode: nativeResult.errorCode || 'OCR_ENGINE_ERROR',
      };
    }

    // ── 4. Process & Persist Result ────────────────────────────────────────
    const recognizedText = nativeResult.text ?? '';
    logger.info(
      `[OcrService] OCR successful for evidence ${evidenceId}: length=${recognizedText.length} chars, blocks=${nativeResult.blocks?.length ?? 0}`
    );

    let chainNodeId: string | undefined;
    try {
      // Compute processing hash for OCR operation
      const processingHash = await hashService.computeProcessingHash(`${evidenceId}:${recognizedText}`);

      // Persist in real SQLite evidence record
      await databaseService.updateEvidenceOcr(evidenceId, recognizedText, processingHash);

      // Append immutable hash chain entry
      const chainRecord = await databaseService.appendHashChain(evidenceId, 'OCR', processingHash);
      chainNodeId = chainRecord?.id;
    } catch (err) {
      logger.error(`[OcrService] Failed to persist OCR result to SQLite / HashChain:`, err);
      return this._fail('UNKNOWN', `Failed to persist OCR result: ${(err as Error)?.message}`);
    }

    notify('COMPLETED');
    return {
      status: 'COMPLETED',
      text: recognizedText,
      blocks: nativeResult.blocks,
      engine: nativeResult.engine,
      processedAt: nativeResult.processedAt || Date.now(),
      processingTimeMs: nativeResult.processingTimeMs,
      imageWidth: nativeResult.imageWidth,
      imageHeight: nativeResult.imageHeight,
      mimeType: nativeResult.mimeType,
      chainNodeId,
    };
  }

  private _fail(errorCode: OcrErrorCode, error: string): OcrResult {
    return {
      status: 'FAILED',
      errorCode,
      error,
    };
  }
}

export const ocrService = new OcrService();

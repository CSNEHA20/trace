import {
  TranscriptionOptions,
  TranscriptionResult,
  TranscriptionStatus,
  TranscriptionErrorCode,
  WhisperModelType,
} from '../types';
import { whisperBridge } from './whisperBridge';
import { sandboxService } from './sandboxService';
import { databaseService } from './databaseService';
import { hashService } from './hashService';
import { logger } from '../utils/logger';

/** Supported audio container extensions */
const SUPPORTED_AUDIO_EXTENSIONS = ['wav', 'mp3', 'm4a', 'aac', 'flac', 'ogg', 'opus', '3gp'];

/**
 * TRACE Whisper.cpp Audio Transcription Service
 *
 * Implements Step 5: On-device audio transcription using Whisper.cpp.
 * Loads strictly from TRACE's private sandbox and executes on local hardware.
 *
 * Rules:
 * - 100% On-Device & Offline: No external network/cloud API dependencies.
 * - ZERO Mock: Never generates synthetic transcripts or fake progress ticks.
 * - Evidence Preservation: Failures never delete or mutate original evidence.
 */
class WhisperService {
  private _activeModel: WhisperModelType = 'tiny';

  async transcribeAudio(
    evidenceId: string,
    sandboxUri: string,
    options: TranscriptionOptions = {}
  ): Promise<TranscriptionResult> {
    const { model = 'tiny', language = 'en', onProgress, onStatusUpdate, cancellationSignal } = options;

    const notify = (s: TranscriptionStatus, msg?: string, pct?: number) => {
      onStatusUpdate?.(s);
      if (pct !== undefined && msg !== undefined) {
        onProgress?.(pct, msg);
      }
    };

    logger.info(`[WhisperService] Starting local Whisper audio transcription for evidence [${evidenceId}] using model [${model}]`);

    // ── 0. Initial Cancellation Check ───────────────────────────────────────
    if (cancellationSignal?.isCancelled) {
      return this._buildErrorResult('CANCELLED', 'Transcription was cancelled before starting');
    }

    notify('VALIDATING', 'Validating audio file in private sandbox...', 10);

    // ── 1. Validate File Path & Format ──────────────────────────────────────
    if (!sandboxUri || typeof sandboxUri !== 'string') {
      return this._buildErrorResult('FILE_NOT_FOUND', 'Invalid sandbox file path provided');
    }

    const extMatch = sandboxUri.match(/\.([a-zA-Z0-9]+)$/);
    const extension = extMatch ? extMatch[1].toLowerCase() : '';
    if (!SUPPORTED_AUDIO_EXTENSIONS.includes(extension)) {
      return this._buildErrorResult(
        'UNSUPPORTED_CODEC',
        `Unsupported audio format extension '.${extension}'. Supported formats: ${SUPPORTED_AUDIO_EXTENSIONS.join(', ')}`
      );
    }

    // ── 2. Validate Sandbox File Exists and is Readable ─────────────────────
    try {
      const fileInfo = await sandboxService.readFileInfo(sandboxUri);
      if (!fileInfo.exists) {
        logger.warn(`[WhisperService] File not found in sandbox: ${sandboxUri}`);
        return this._buildErrorResult('FILE_NOT_FOUND', `Audio file does not exist in sandbox: ${sandboxUri}`);
      }
      if (fileInfo.size === 0) {
        logger.warn(`[WhisperService] File is 0 bytes: ${sandboxUri}`);
        return this._buildErrorResult('FILE_UNREADABLE', 'Audio evidence file is empty (0 bytes)');
      }
    } catch (err) {
      logger.warn(`[WhisperService] Sandbox read check failed:`, err);
      return this._buildErrorResult('FILE_UNREADABLE', (err as Error)?.message || 'Could not verify file accessibility');
    }

    if (cancellationSignal?.isCancelled) {
      return this._buildErrorResult('CANCELLED', 'Transcription was cancelled by user');
    }

    // ── 3. Load / Verify Model ──────────────────────────────────────────────
    notify('LOADING_MODEL', `Loading Whisper.cpp ${model} model...`, 25);
    try {
      await whisperBridge.loadModelAsync({ modelType: model, language });
      this._activeModel = model;
    } catch (err: any) {
      const code = err.code || err.message;
      if (typeof code === 'string' && (code.includes('MODEL_UNAVAILABLE') || code.includes('MODEL_MISSING') || code.includes('not installed'))) {
        notify('MODEL_UNAVAILABLE');
        return {
          status: 'MODEL_UNAVAILABLE',
          errorCode: 'MODEL_UNAVAILABLE',
          error: err.message || `Whisper model [${model}] is not installed in trace-models/`,
        };
      }
      return this._buildErrorResult('MODEL_ERROR', err.message || 'Failed to load Whisper model');
    }

    if (cancellationSignal?.isCancelled) {
      await whisperBridge.freeModelAsync();
      return this._buildErrorResult('CANCELLED', 'Transcription was cancelled after model load');
    }

    // ── 4. Execute On-Device Inference ──────────────────────────────────────
    notify('PROCESSING', 'Running on-device acoustic model inference...', 50);
    let bridgeResult;
    try {
      bridgeResult = await whisperBridge.transcribeAudioFileAsync(sandboxUri, {
        modelType: model,
        language,
      });
    } catch (err: any) {
      logger.error(`[WhisperService] Whisper inference error:`, err);
      const code = err.code || 'TRANSCRIPTION_FAILED';
      let mappedErrorCode: TranscriptionErrorCode = 'TRANSCRIPTION_FAILED';
      if (code === 'FILE_NOT_FOUND') mappedErrorCode = 'FILE_NOT_FOUND';
      else if (code === 'FILE_UNREADABLE') mappedErrorCode = 'FILE_UNREADABLE';
      else if (code === 'NOT_AN_AUDIO') mappedErrorCode = 'NOT_AN_AUDIO';
      else if (code === 'UNSUPPORTED_CODEC') mappedErrorCode = 'UNSUPPORTED_CODEC';
      else if (code === 'MODEL_UNAVAILABLE') mappedErrorCode = 'MODEL_UNAVAILABLE';
      else if (code === 'DECODE_FAILED') mappedErrorCode = 'DECODE_FAILED';
      else if (code === 'ENGINE_UNAVAILABLE') mappedErrorCode = 'ENGINE_UNAVAILABLE';

      return this._buildErrorResult(mappedErrorCode, err.message || 'Whisper decoding failed');
    }

    const transcriptText = bridgeResult.text ?? '';
    logger.info(`[WhisperService] Whisper completed successfully for evidence [${evidenceId}]: length=${transcriptText.length} chars`);

    // ── 5. Generate Processing Hash & Update SQLite & Hash Chain ───────────
    notify('PROCESSING', 'Updating SQLite and immutable ledger...', 90);
    let chainNodeId: string | undefined;
    let processingHash: string = '';

    try {
      // Processing hash = SHA-256(evidenceId + ':' + transcriptText)
      processingHash = await hashService.computeProcessingHash(`${evidenceId}:${transcriptText}`);

      // Update SQLite evidence record
      await databaseService.updateEvidenceTranscription(evidenceId, transcriptText, processingHash);

      // Append immutable hash chain entry
      const chainRecord = await databaseService.appendHashChain(evidenceId, 'TRANSCRIBE', processingHash);
      chainNodeId = chainRecord?.id;
    } catch (err) {
      logger.error(`[WhisperService] Persistence error:`, err);
      return this._buildErrorResult('UNKNOWN', `Failed to persist transcription: ${(err as Error)?.message}`);
    }

    notify('COMPLETED', 'Transcription completed successfully.', 100);

    return {
      status: 'COMPLETED',
      text: transcriptText,
      segments: bridgeResult.segments,
      language: bridgeResult.language,
      durationSeconds: bridgeResult.durationSeconds,
      confidence: bridgeResult.confidence,
      processingTimeMs: bridgeResult.processingTimeMs,
      engine: bridgeResult.engine,
      processingHash,
      chainNodeId,
    };
  }

  private _buildErrorResult(
    errorCode: TranscriptionErrorCode,
    errorMsg: string
  ): TranscriptionResult {
    const status: TranscriptionStatus = errorCode === 'CANCELLED' ? 'CANCELLED' : 'FAILED';
    return {
      status,
      error: errorMsg,
      errorCode,
    };
  }
}

export const whisperService = new WhisperService();

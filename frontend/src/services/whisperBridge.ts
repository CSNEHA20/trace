import { NativeModules, Platform } from 'react-native';
import { logger } from '../utils/logger';
import { WhisperModelType, TranscriptionSegment } from '../types';

export interface NativeWhisperParams {
  modelType?: WhisperModelType;
  modelPath?: string;
  language?: string;
  nThreads?: number;
  translate?: boolean;
}

export interface NativeWhisperResult {
  text: string;
  language: string;
  durationSeconds?: number;
  confidence?: number;
  processingTimeMs?: number;
  engine?: string;
  segments?: TranscriptionSegment[];
}

export interface NativeWhisperAvailability {
  available: boolean;
  engine?: string;
  model?: string;
  modelSize?: number;
  modelPath?: string;
  offline?: boolean;
  lifecycle?: string;
  error?: string;
}

/**
 * TRACE Whisper.cpp Native Bridge
 *
 * Connects the TypeScript layer to the on-device Whisper.cpp Android native module (`TraceWhisper`).
 * 
 * Rules:
 * - 100% On-Device & Offline: No cloud endpoints or external APIs.
 * - ZERO Mock: Never generates synthetic transcripts, predetermined text, or fake progress.
 */
class WhisperBridge {
  private get _nativeModule() {
    return NativeModules.TraceWhisper;
  }

  async isAvailable(): Promise<NativeWhisperAvailability> {
    if (Platform.OS !== 'android') {
      return {
        available: false,
        error: `Whisper.cpp native runtime is only available on Android (current OS: ${Platform.OS})`,
      };
    }

    const traceWhisper = this._nativeModule;
    if (!traceWhisper || typeof traceWhisper.getCapabilities !== 'function') {
      return {
        available: false,
        error: 'TraceWhisper native module is not registered in NativeModules',
      };
    }

    try {
      const caps = await traceWhisper.getCapabilities();
      return {
        available: caps.available === true,
        engine: caps.engine,
        model: caps.modelName,
        modelSize: caps.modelSize,
        modelPath: caps.modelPath,
        offline: caps.offline,
        lifecycle: caps.lifecycle,
      };
    } catch (err) {
      logger.warn('[WhisperBridge] Availability check failed', err);
      return {
        available: false,
        error: (err as Error)?.message || 'Availability check failed',
      };
    }
  }

  async loadModelAsync(params: NativeWhisperParams): Promise<boolean> {
    const traceWhisper = this._nativeModule;
    if (!traceWhisper || typeof traceWhisper.loadModel !== 'function') {
      throw new Error('TraceWhisper native module is not linked or registered.');
    }

    const modelType = params.modelType || 'tiny';
    logger.info(`[WhisperBridge] Loading on-device GGML Whisper model: ${modelType}`);

    try {
      const res = await traceWhisper.loadModel({
        modelType,
        language: params.language || 'en',
      });
      return res?.success === true;
    } catch (err: any) {
      logger.error(`[WhisperBridge] Model load error: ${err.message}`);
      throw err;
    }
  }

  async transcribeAudioFileAsync(
    audioFilePath: string,
    params: NativeWhisperParams = {}
  ): Promise<NativeWhisperResult> {
    if (Platform.OS !== 'android') {
      throw new Error(`Whisper.cpp on-device transcription is only supported on Android. Current platform is ${Platform.OS}.`);
    }

    const traceWhisper = this._nativeModule;
    if (!traceWhisper || typeof traceWhisper.transcribe !== 'function') {
      throw new Error('TraceWhisper native module is not linked or registered.');
    }

    logger.info(`[WhisperBridge] Executing on-device Whisper inference on: ${audioFilePath}`);
    const rawResult = await traceWhisper.transcribe(audioFilePath, {
      modelType: params.modelType || 'tiny',
      language: params.language || 'en',
    });

    const segments: TranscriptionSegment[] = (rawResult.segments || []).map((s: any) => ({
      t0: s.t0 ?? 0,
      t1: s.t1 ?? 0,
      text: s.text ?? '',
      confidence: s.confidence,
    }));

    return {
      text: rawResult.text ?? '',
      language: rawResult.language ?? (params.language || 'en'),
      durationSeconds: rawResult.durationSeconds,
      confidence: rawResult.confidence,
      processingTimeMs: rawResult.processingTimeMs,
      engine: rawResult.engine || 'Whisper.cpp GGML (On-Device)',
      segments,
    };
  }

  async freeModelAsync(): Promise<void> {
    const traceWhisper = this._nativeModule;
    if (traceWhisper && typeof traceWhisper.unloadModel === 'function') {
      try {
        await traceWhisper.unloadModel();
      } catch (err) {
        logger.warn('[WhisperBridge] Error unloading model', err);
      }
    }
  }
}

export const whisperBridge = new WhisperBridge();

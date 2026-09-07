import { NativeModules, Platform } from 'react-native';
import { OcrResult } from '../types';
import { logger } from '../utils/logger';

const { TraceOcr } = NativeModules;

export interface NativeOcrAvailability {
  available: boolean;
  engine?: string;
  model?: string;
  bundled?: boolean;
  offline?: boolean;
  error?: string;
}

/**
 * TRACE Native OCR Bridge
 * 
 * Direct interface to the native Google ML Kit Text Recognition module on Android.
 * In accordance with TRACE Zero-Mock architecture, this bridge NEVER simulates OCR
 * or returns synthetic text.
 */
class OcrNativeBridge {
  private get _nativeModule() {
    return NativeModules.TraceOcr;
  }

  async isAvailable(): Promise<NativeOcrAvailability> {
    if (Platform.OS !== 'android') {
      return {
        available: false,
        error: `Native ML Kit OCR is only available on Android (current OS: ${Platform.OS})`,
      };
    }

    const traceOcr = this._nativeModule;
    if (!traceOcr || typeof traceOcr.isAvailable !== 'function') {
      return {
        available: false,
        error: 'TraceOcr native module is not registered in NativeModules',
      };
    }

    try {
      const info = await traceOcr.isAvailable();
      return {
        available: info.available === true,
        engine: info.engine,
        model: info.model,
        bundled: info.bundled,
        offline: info.offline,
      };
    } catch (err) {
      logger.warn('Error checking TraceOcr availability', err);
      return {
        available: false,
        error: (err as Error)?.message || 'Availability check failed',
      };
    }
  }

  async recognizeText(fileUri: string): Promise<OcrResult> {
    if (Platform.OS !== 'android') {
      return {
        status: 'FAILED',
        error: `ML Kit OCR native module is only supported on Android. Current platform is ${Platform.OS}.`,
        errorCode: 'ENGINE_UNAVAILABLE',
      };
    }

    const traceOcr = this._nativeModule;
    if (!traceOcr || typeof traceOcr.recognizeText !== 'function') {
      return {
        status: 'FAILED',
        error: 'TraceOcr native module is not linked or registered.',
        errorCode: 'ENGINE_UNAVAILABLE',
      };
    }

    try {
      logger.info(`TraceOcr: Invoking native ML Kit text recognition for ${fileUri}`);
      const rawResult = await traceOcr.recognizeText(fileUri);

      return {
        status: 'COMPLETED',
        text: rawResult.text ?? '',
        blocks: (rawResult.blocks || []).map((b: any) => ({
          text: b.text || '',
          language: b.recognizedLanguage,
          boundingBox: b.boundingBox ? {
            left: b.boundingBox.left,
            top: b.boundingBox.top,
            right: b.boundingBox.right,
            bottom: b.boundingBox.bottom,
            width: b.boundingBox.width,
            height: b.boundingBox.height,
          } : undefined,
          lines: b.lines || [],
        })),
        engine: rawResult.engine || 'Google ML Kit Text Recognition (On-Device Latin)',
        imageWidth: rawResult.imageWidth,
        imageHeight: rawResult.imageHeight,
        mimeType: rawResult.mimeType,
        processingTimeMs: rawResult.processingTimeMs,
        processedAt: Date.now(),
      };
    } catch (err: any) {
      const code = err.code || 'OCR_ENGINE_ERROR';
      const msg = err.message || 'OCR extraction failed';
      logger.error(`TraceOcr failed with code [${code}]: ${msg}`);

      let errorCode = 'OCR_ENGINE_ERROR';
      if (code === 'FILE_NOT_FOUND') errorCode = 'FILE_NOT_FOUND';
      else if (code === 'FILE_UNREADABLE') errorCode = 'FILE_UNREADABLE';
      else if (code === 'NOT_AN_IMAGE') errorCode = 'NOT_AN_IMAGE';
      else if (code === 'DECODE_FAILED') errorCode = 'DECODE_FAILED';

      return {
        status: 'FAILED',
        error: msg,
        errorCode: errorCode as any,
      };
    }
  }
}

export const ocrNativeBridge = new OcrNativeBridge();

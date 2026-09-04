/**
 * TRACE Frontend Module Entry Point
 */

export interface CaseEvidenceItem {
  id: string;
  timestamp: number;
  sha256Hash: string;
  mediaUri: string;
  exifData?: Record<string, unknown>;
  aiAnalysisResult?: {
    gemmaSummary?: string;
    ocrText?: string[];
    facesDetected?: number;
    transcription?: string;
  };
  signature: string;
}

export const TRACE_VERSION = '1.0.0';

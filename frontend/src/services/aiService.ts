import { AiAnalysisResult, EvidenceType, EventRecord } from '../types';
import { logger } from '../utils/logger';
import { timelineClusterer, ClusterOptions } from '../../../ai/clustering/timelineClusterer';
import { ClusterOperationResult } from '../../../ai/clustering/clusterTypes';

class AiService {
  async analyzeEvidence(
    fileUri: string,
    type: EvidenceType,
    evidenceId?: string
  ): Promise<AiAnalysisResult> {
    logger.info(`Running on-device AI inference pipeline for ${type} at ${fileUri}`);

    // This legacy method has no extracted text input. Do not fabricate a model
    // response; callers must invoke the on-device inference service with real
    // OCR/transcription text once the local model status is AVAILABLE.
    return { processedAt: Date.now() };
  }

  async clusterIncidentEvents(caseId: string, options?: ClusterOptions): Promise<ClusterOperationResult> {
    logger.info(`Clustering incident events for case ${caseId} with local Gemma 2B`);
    return timelineClusterer.clusterCase(caseId, options);
  }

  async annotateClusterEvent(
    eventId: string,
    updates: {
      event_type?: string;
      severity?: number;
      ai_summary?: string;
      user_annotation?: string;
      timestamp_hint?: string | null;
    }
  ): Promise<EventRecord> {
    return timelineClusterer.annotateEvent(eventId, updates);
  }
}

export const aiService = new AiService();

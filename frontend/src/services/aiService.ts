import { AiAnalysisResult, EvidenceType, EventRecord, NarrativeRecord } from '../types';
import { logger } from '../utils/logger';
import { timelineClusterer, ClusterOptions } from '../../../ai/clustering/timelineClusterer';
import { ClusterOperationResult } from '../../../ai/clustering/clusterTypes';
import { narrativeGenerator, NarrativeGenerationResult } from '../../../ai/narrative/narrativeGenerator';
import { databaseService } from './databaseService';

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

  async generateIncidentNarrative(
    caseId: string,
    options?: {
      onProgress?: (progress: { stage: string; completedChunks: number; totalChunks: number; message: string }) => void;
      useExistingEvents?: boolean;
    }
  ): Promise<NarrativeGenerationResult> {
    logger.info(`Generating incident narrative for case ${caseId} with local Gemma 2B`);

    const events = await databaseService.getEventRecordsForCase(caseId);
    if (!events.length && options?.useExistingEvents !== false) {
      throw new Error('No clustered events found for this case. Run event clustering first.');
    }

    const result = await narrativeGenerator.generateIncidentNarrative(caseId, events, {
      onProgress: options?.onProgress,
    });

    const eventsSnapshot = events.map(e => e.id);
    await databaseService.saveNarrative(caseId, {
      content: result.narrative,
      eventsSnapshot,
      disclaimer: result.disclaimer,
      parseError: result.parseError,
    });

    return result;
  }

  async getLatestNarrative(caseId: string): Promise<NarrativeRecord | null> {
    return databaseService.getLatestNarrativeForCase(caseId);
  }

  async getNarrativesForCase(caseId: string): Promise<NarrativeRecord[]> {
    return databaseService.getNarrativesForCase(caseId);
  }
}

export const aiService = new AiService();

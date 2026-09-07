import { create } from 'zustand';
import { AiCapability, mediaPipeClient } from '../../../ai/inference/mediapipeClient';
import { InferenceProgress, onDeviceInferenceService } from '../../../ai/inference/inferenceService';
import { ClusterOperationResult } from '../../../ai/clustering/clusterTypes';
import {
  forensicAnalysisService,
  CompleteForensicAnalysisResult,
  ForensicAnalysisOptions,
} from '../services/forensicAnalysisService';

interface AiState {
  capability?: AiCapability;
  progress: InferenceProgress;
  isAnalyzing: boolean;
  lastAnalysisResult?: CompleteForensicAnalysisResult;
  clusterResult?: ClusterOperationResult;
  error?: string | null;

  setCapability: (capability: AiCapability) => void;
  setProgress: (progress: InferenceProgress) => void;
  setClusterResult: (clusterResult?: ClusterOperationResult) => void;
  setAnalysisResult: (result?: CompleteForensicAnalysisResult) => void;
  clearError: () => void;

  refreshCapability: () => Promise<AiCapability>;
  runCaseAnalysis: (caseId: string, options?: ForensicAnalysisOptions) => Promise<CompleteForensicAnalysisResult>;
}

export const useAiStore = create<AiState>((set, get) => ({
  progress: { stage: 'IDLE', completedChunks: 0, totalChunks: 0, message: 'Ready' },
  isAnalyzing: false,
  error: null,

  setCapability: (capability) => set({ capability }),
  setProgress: (progress) => set({ progress }),
  setClusterResult: (clusterResult) => set({ clusterResult }),
  setAnalysisResult: (lastAnalysisResult) => set({ lastAnalysisResult }),
  clearError: () => set({ error: null }),

  refreshCapability: async () => {
    const cap = await onDeviceInferenceService.capability();
    set({ capability: cap });
    return cap;
  },

  runCaseAnalysis: async (caseId: string, options?: ForensicAnalysisOptions) => {
    set({
      isAnalyzing: true,
      error: null,
      progress: { stage: 'CHECKING', completedChunks: 0, totalChunks: 1, message: 'Initiating forensic analysis…' },
    });

    try {
      const result = await forensicAnalysisService.analyzeCaseEvidence(caseId, {
        ...options,
        onProgress: (p) => {
          set({ progress: p });
          options?.onProgress?.(p);
        },
      });

      set({
        isAnalyzing: false,
        lastAnalysisResult: result,
        progress: { stage: 'COMPLETE', completedChunks: 1, totalChunks: 1, message: 'Analysis complete.' },
      });
      return result;
    } catch (err: any) {
      const errorMsg = err instanceof Error ? err.message : 'Forensic analysis failed';
      set({
        isAnalyzing: false,
        error: errorMsg,
        progress: { stage: 'FAILED', completedChunks: 0, totalChunks: 1, message: errorMsg },
      });
      throw err;
    }
  },
}));

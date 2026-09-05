import { create } from 'zustand';
import { AiCapability } from '../../../ai/inference/mediapipeClient';
import { InferenceProgress } from '../../../ai/inference/inferenceService';
import { ClusterOperationResult } from '../../../ai/clustering/clusterTypes';

interface AiState {
  capability?: AiCapability;
  progress: InferenceProgress;
  clusterResult?: ClusterOperationResult;
  setCapability: (capability: AiCapability) => void;
  setProgress: (progress: InferenceProgress) => void;
  setClusterResult: (clusterResult?: ClusterOperationResult) => void;
}

export const useAiStore = create<AiState>((set) => ({
  progress: { stage: 'IDLE', completedChunks: 0, totalChunks: 0, message: 'Not running' },
  setCapability: (capability) => set({ capability }),
  setProgress: (progress) => set({ progress }),
  setClusterResult: (clusterResult) => set({ clusterResult }),
}));

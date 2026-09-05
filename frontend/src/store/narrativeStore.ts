import { create } from 'zustand';
import { NarrativeRecord } from '../types';
import { databaseService } from '../services/databaseService';
import { logger } from '../utils/logger';

interface NarrativeState {
  currentNarrative: NarrativeRecord | null;
  isGenerating: boolean;
  generationProgress: { stage: string; completedChunks: number; totalChunks: number; message: string } | null;
  error: string | null;
  setCurrentNarrative: (narrative: NarrativeRecord | null) => void;
  setGenerating: (generating: boolean) => void;
  setProgress: (progress: { stage: string; completedChunks: number; totalChunks: number; message: string } | null) => void;
  setError: (error: string | null) => void;
  loadLatestNarrative: (caseId: string) => Promise<void>;
  clear: () => void;
}

export const useNarrativeStore = create<NarrativeState>((set, get) => ({
  currentNarrative: null,
  isGenerating: false,
  generationProgress: null,
  error: null,

  setCurrentNarrative: (narrative) => set({ currentNarrative: narrative }),
  setGenerating: (isGenerating) => set({ isGenerating }),
  setProgress: (progress) => set({ generationProgress: progress }),
  setError: (error) => set({ error }),

  loadLatestNarrative: async (caseId: string) => {
    try {
      const narrative = await databaseService.getLatestNarrativeForCase(caseId);
      set({ currentNarrative: narrative });
    } catch (err) {
      logger.error('Failed to load narrative', err);
      set({ error: (err as Error).message || 'Failed to load narrative' });
    }
  },

  clear: () => set({ currentNarrative: null, isGenerating: false, generationProgress: null, error: null }),
}));
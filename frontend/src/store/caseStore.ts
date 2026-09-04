import { create } from 'zustand';
import { Case } from '../types';
import { databaseService } from '../services/databaseService';
import { logger } from '../utils/logger';

interface CaseState {
  cases: Case[];
  activeCase: Case | null;
  isLoading: boolean;
  error: string | null;
  fetchCases: () => Promise<void>;
  selectCase: (id: string) => Promise<void>;
  createCase: (title: string, description: string, investigatorName: string) => Promise<Case>;
}

export const useCaseStore = create<CaseState>((set, get) => ({
  cases: [],
  activeCase: null,
  isLoading: false,
  error: null,

  fetchCases: async () => {
    set({ isLoading: true, error: null });
    try {
      const cases = await databaseService.getAllCases();
      const activeCase = get().activeCase || cases[0] || null;
      set({ cases, activeCase, isLoading: false });
    } catch (err: unknown) {
      logger.error('Failed to fetch cases', err);
      set({ error: (err as Error).message || 'Failed to load cases', isLoading: false });
    }
  },

  selectCase: async (id: string) => {
    const target = await databaseService.getCaseById(id);
    set({ activeCase: target });
  },

  createCase: async (title: string, description: string, investigatorName: string) => {
    set({ isLoading: true, error: null });
    try {
      const newCase = await databaseService.createCase(title, description, investigatorName);
      const cases = await databaseService.getAllCases();
      set({ cases, activeCase: newCase, isLoading: false });
      return newCase;
    } catch (err: unknown) {
      logger.error('Failed to create case', err);
      set({ error: (err as Error).message || 'Failed to create case', isLoading: false });
      throw err;
    }
  },
}));

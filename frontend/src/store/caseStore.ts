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
      let cases = await databaseService.getAllCases();
      if (cases.length === 0) {
        // Auto-seed initial case on fresh launch so the workspace is immediately live
        try {
          const initialCase = await databaseService.createCase(
            'Primary Incident Investigation',
            'Authoritative digital forensic intake and cryptographic hash-chain ledger',
            'Forensic Officer'
          );
          cases = [initialCase];
        } catch {
          // If write fails, proceed with empty or fallback
        }
      }
      const activeCase = get().activeCase || cases[0] || null;
      set({ cases, activeCase, isLoading: false });
    } catch (err: unknown) {
      logger.error('Failed to fetch cases', err);
      // In-memory fallback if SQLite encounters platform restrictions on web
      const fallbackCase: Case = {
        id: 'CASE-001',
        caseNumber: 'TR-2026-001',
        title: 'Primary Incident Investigation',
        description: 'Authoritative digital forensic intake and cryptographic hash-chain ledger',
        investigatorName: 'Forensic Officer',
        status: 'ACTIVE',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        evidenceIds: [],
      };
      set({ cases: [fallbackCase], activeCase: fallbackCase, error: (err as Error).message, isLoading: false });
    }
  },

  selectCase: async (id: string) => {
    try {
      const target = await databaseService.getCaseById(id);
      if (target) {
        set({ activeCase: target });
      }
    } catch (err) {
      logger.error('Failed to select case', err);
    }
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

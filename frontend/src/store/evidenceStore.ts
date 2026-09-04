import { create } from 'zustand';
import { EvidenceItem, EvidenceType } from '../types';
import { databaseService } from '../services/databaseService';
import { cryptoService } from '../services/cryptoService';
import { exifService } from '../services/exifService';
import { aiService } from '../services/aiService';
import { logger } from '../utils/logger';

interface EvidenceState {
  evidenceList: EvidenceItem[];
  selectedEvidence: EvidenceItem | null;
  isLoading: boolean;
  filterType: EvidenceType | 'ALL';
  searchQuery: string;
  error: string | null;
  fetchEvidence: (caseId?: string) => Promise<void>;
  selectEvidence: (id: string) => Promise<void>;
  setFilterType: (type: EvidenceType | 'ALL') => void;
  setSearchQuery: (query: string) => void;
  captureAndProcessEvidence: (params: {
    caseId: string;
    title: string;
    description?: string;
    type: EvidenceType;
    fileUri: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
  }) => Promise<EvidenceItem>;
}

export const useEvidenceStore = create<EvidenceState>((set, get) => ({
  evidenceList: [],
  selectedEvidence: null,
  isLoading: false,
  filterType: 'ALL',
  searchQuery: '',
  error: null,

  fetchEvidence: async (caseId?: string) => {
    set({ isLoading: true, error: null });
    try {
      const list = caseId
        ? await databaseService.getEvidenceForCase(caseId)
        : await databaseService.getAllEvidence();
      set({ evidenceList: list, isLoading: false });
    } catch (err: unknown) {
      logger.error('Failed to fetch evidence items', err);
      set({ error: (err as Error).message || 'Failed to load evidence', isLoading: false });
    }
  },

  selectEvidence: async (id: string) => {
    const item = await databaseService.getEvidenceById(id);
    set({ selectedEvidence: item });
  },

  setFilterType: (type) => set({ filterType: type }),
  setSearchQuery: (query) => set({ searchQuery: query }),

  captureAndProcessEvidence: async (params) => {
    set({ isLoading: true, error: null });
    try {
      // 1. Hash creation
      const hash = await cryptoService.computeSHA256(params.fileUri);
      // 2. Hardware signature creation
      const signature = await cryptoService.signPayload(hash);
      // 3. EXIF metadata extraction
      const exifData = await exifService.extractMetadata(params.fileUri);
      // 4. On-Device AI inference
      const aiAnalysis = await aiService.analyzeEvidence(params.fileUri, params.type);

      const newItem = await databaseService.addEvidence({
        caseId: params.caseId,
        title: params.title,
        description: params.description,
        type: params.type,
        fileUri: params.fileUri,
        fileName: params.fileName,
        fileSize: params.fileSize,
        mimeType: params.mimeType,
        sha256Hash: hash,
        signature,
        exifData,
        aiAnalysis,
        isTampered: false,
      });

      const updatedList = await databaseService.getEvidenceForCase(params.caseId);
      set({ evidenceList: updatedList, selectedEvidence: newItem, isLoading: false });
      return newItem;
    } catch (err: unknown) {
      logger.error('Failed to capture evidence', err);
      set({ error: (err as Error).message || 'Capture failed', isLoading: false });
      throw err;
    }
  },
}));

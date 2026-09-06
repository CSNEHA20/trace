import { create } from 'zustand';
import {
  Case,
  EvidenceItem,
  ExportPackageResult,
  ForensicReportManifest,
  ReportExportStatus,
  ReportOptions,
  IncidentReportOptions,
  IncidentReportMetadata,
  IncidentReportGenerationResult,
  DEFAULT_INCIDENT_REPORT_OPTIONS,
} from '../types';
import { exportService, DEFAULT_REPORT_OPTIONS } from '../services/exportService';
import { incidentReportGenerator } from '../report';
import { logger } from '../utils/logger';

interface ReportState {
  // Forensic Report State
  options: ReportOptions;
  status: ReportExportStatus;
  lastManifest: ForensicReportManifest | null;
  lastExportResult: ExportPackageResult | null;
  generatedReports: ForensicReportManifest[];
  
  // Incident Report State
  incidentOptions: IncidentReportOptions;
  incidentStatus: ReportExportStatus;
  lastIncidentReport: IncidentReportMetadata | null;
  lastIncidentResult: IncidentReportGenerationResult | null;
  generatedIncidentReports: IncidentReportMetadata[];
  
  error: string | null;

  // Actions - Forensic Report
  updateOptions: (partial: Partial<ReportOptions>) => void;
  generateReport: (c: Case, evidenceList: EvidenceItem[]) => Promise<ExportPackageResult | null>;
  shareCurrentReport: () => Promise<boolean>;
  resetReportState: () => void;

  // Actions - Incident Report
  updateIncidentOptions: (partial: Partial<IncidentReportOptions>) => void;
  generateIncidentReport: (caseId: string) => Promise<IncidentReportGenerationResult | null>;
  shareIncidentReport: () => Promise<boolean>;
  resetIncidentReportState: () => void;
}

export const useReportStore = create<ReportState>((set, get) => ({
  // Forensic Report State
  options: { ...DEFAULT_REPORT_OPTIONS },
  status: 'IDLE',
  lastManifest: null,
  lastExportResult: null,
  generatedReports: [],
  
  // Incident Report State
  incidentOptions: { ...DEFAULT_INCIDENT_REPORT_OPTIONS },
  incidentStatus: 'IDLE',
  lastIncidentReport: null,
  lastIncidentResult: null,
  generatedIncidentReports: [],
  
  error: null,

  // Actions - Forensic Report
  updateOptions: (partial) => {
    set((state) => ({
      options: { ...state.options, ...partial },
    }));
  },

  generateReport: async (c, evidenceList) => {
    try {
      set({ status: 'GENERATING_HTML', error: null });

      const options = get().options;
      const res = await exportService.generateCaseReport(c, evidenceList, options);

      set({ status: 'SIGNING' });

      const manifest: ForensicReportManifest = {
        reportId: `REP_${Date.now()}`,
        caseId: c.id,
        caseNumber: c.caseNumber,
        caseTitle: c.title,
        investigatorName: c.investigatorName,
        agencyName: options.agencyName,
        generatedAt: res.exportedAt,
        evidenceCount: evidenceList.length,
        tamperedEvidenceCount: evidenceList.filter((e) => e.isTampered).length,
        evidenceItems: evidenceList.map((e) => ({
          id: e.id,
          fileName: e.fileName,
          mediaType: e.type,
          fileSize: e.fileSize,
          sha256Hash: e.sha256Hash,
          signature: e.signature,
          importTs: e.timestamp,
          isTampered: !!e.isTampered,
          tamperReason: e.tamperReason,
          exifMakeModel: e.exifData ? `${e.exifData.make || ''} ${e.exifData.model || ''}`.trim() : undefined,
          ocrSnippet: e.aiAnalysis?.detectedText?.[0],
          transcriptionSnippet: e.aiAnalysis?.transcription,
          gemmaSummary: e.aiAnalysis?.gemmaSummary,
        })),
        investigatorNotes: options.investigatorNotes,
        manifestHash: res.manifestHash,
        digitalSignature: res.digitalSignature,
        pdfUri: res.pdfUri,
        htmlContent: res.htmlContent,
      };

      set((state) => ({
        status: 'COMPLETE',
        lastManifest: manifest,
        lastExportResult: res,
        generatedReports: [manifest, ...state.generatedReports],
      }));

      return res;
    } catch (err) {
      const msg = (err as Error)?.message || 'Failed to generate report';
      logger.error('Report generation error', err);
      set({ status: 'FAILED', error: msg });
      return null;
    }
  },

  shareCurrentReport: async () => {
    const lastResult = get().lastExportResult;
    if (!lastResult || !lastResult.pdfUri) {
      set({ error: 'No generated report available to share' });
      return false;
    }
    return exportService.shareReport(lastResult.pdfUri);
  },

  resetReportState: () => {
    set({
      status: 'IDLE',
      lastManifest: null,
      lastExportResult: null,
      error: null,
    });
  },

  // Actions - Incident Report
  updateIncidentOptions: (partial) => {
    set((state) => ({
      incidentOptions: { ...state.incidentOptions, ...partial },
    }));
    incidentReportGenerator.updateOptions(partial);
  },

  generateIncidentReport: async (caseId) => {
    try {
      set({ incidentStatus: 'GENERATING_HTML', error: null });

      const res = await incidentReportGenerator.generateReport(caseId);

      set({ incidentStatus: 'SIGNING' });

      if (res) {
        const manifest: IncidentReportMetadata = {
          ...res.metadata,
          manifestHash: res.manifestHash,
        };

        set((state) => ({
          incidentStatus: 'COMPLETE',
          lastIncidentReport: manifest,
          lastIncidentResult: res,
          generatedIncidentReports: [manifest, ...state.generatedIncidentReports],
        }));
      }

      return res;
    } catch (err) {
      const msg = (err as Error)?.message || 'Failed to generate incident report';
      logger.error('Incident report generation error', err);
      set({ incidentStatus: 'FAILED', error: msg });
      return null;
    }
  },

  shareIncidentReport: async () => {
    const lastResult = get().lastIncidentResult;
    if (!lastResult || !lastResult.pdfUri) {
      set({ error: 'No generated incident report available to share' });
      return false;
    }
    return incidentReportGenerator.shareReport(lastResult.pdfUri);
  },

  resetIncidentReportState: () => {
    set({
      incidentStatus: 'IDLE',
      lastIncidentReport: null,
      lastIncidentResult: null,
      error: null,
    });
  },
}));
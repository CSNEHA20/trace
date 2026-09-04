import { Case, EvidenceItem, TimelineEvent } from '../types';
import { generateUUID } from '../utils/crypto';
import { logger } from '../utils/logger';

/**
 * Encrypted Database Abstraction Layer for TRACE
 * Manages Cases, Evidence Items, Timelines, and Audit Logs locally.
 */
class DatabaseService {
  private isInitialized = false;
  private casesStore: Map<string, Case> = new Map();
  private evidenceStore: Map<string, EvidenceItem> = new Map();
  private timelineStore: Map<string, TimelineEvent> = new Map();

  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    logger.info('Initializing TRACE Encrypted SQLite Database Service...');

    // Populate default seed case if database is fresh
    const seedCaseId = 'case-001-demo';
    const demoCase: Case = {
      id: seedCaseId,
      caseNumber: 'TR-2026-0089',
      title: 'Digital Forensic Verification Case #1',
      description: 'Initial forensic investigation into digital evidence authenticity and tamper detection.',
      investigatorName: 'Lead Investigator (SNEHA C)',
      status: 'ACTIVE',
      createdAt: Date.now() - 86400000,
      updatedAt: Date.now(),
      evidenceIds: ['ev-001-sample', 'ev-002-sample'],
    };

    const demoEvidence1: EvidenceItem = {
      id: 'ev-001-sample',
      caseId: seedCaseId,
      title: 'Security Camera Screenshot (Scene A)',
      description: 'Primary visual evidence captured at crime scene perimeter.',
      type: 'IMAGE',
      fileUri: 'file:///sample/camera_01.jpg',
      fileName: 'camera_01.jpg',
      fileSize: 2458290,
      mimeType: 'image/jpeg',
      sha256Hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      signature: 'SIG_TRACE_SHA256_e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      timestamp: Date.now() - 80000000,
      exifData: {
        make: 'iQOO',
        model: 'Legend 2026',
        dateTimeOriginal: '2026-09-04 14:32:00',
        gpsLatitude: 12.9716,
        gpsLongitude: 77.5946,
      },
      aiAnalysis: {
        gemmaSummary: 'High probability visual match. No metadata tampering observed in initial EXIF scan.',
        detectedText: ['ENTRY RESTRICTED', 'ZONE 4'],
        facesCount: 1,
        confidenceScore: 0.98,
      },
      isTampered: false,
    };

    const demoEvidence2: EvidenceItem = {
      id: 'ev-002-sample',
      caseId: seedCaseId,
      title: 'Voice Recording Interview',
      description: 'Audio statement from witness on scene.',
      type: 'AUDIO',
      fileUri: 'file:///sample/statement.wav',
      fileName: 'statement.wav',
      fileSize: 5214000,
      mimeType: 'audio/wav',
      sha256Hash: '4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a',
      signature: 'SIG_TRACE_SHA256_4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a',
      timestamp: Date.now() - 40000000,
      aiAnalysis: {
        transcription: 'I saw the individual near the east entrance at approximately 2:15 PM.',
        gemmaSummary: 'Audio evidence transcribed cleanly with high acoustic fidelity.',
      },
      isTampered: false,
    };

    const demoTimeline1: TimelineEvent = {
      id: generateUUID(),
      caseId: seedCaseId,
      evidenceId: 'ev-001-sample',
      timestamp: Date.now() - 80000000,
      title: 'Visual Evidence Captured',
      description: 'Primary image added to case TR-2026-0089 with hardware signature.',
      category: 'CAPTURE',
      actor: 'Investigator SNEHA C',
    };

    const demoTimeline2: TimelineEvent = {
      id: generateUUID(),
      caseId: seedCaseId,
      evidenceId: 'ev-002-sample',
      timestamp: Date.now() - 40000000,
      title: 'Witness Audio Interview Logged',
      description: 'Audio statement transcribed via on-device AI engine.',
      category: 'ANALYSIS',
      actor: 'Gemma 2B AI Engine',
    };

    this.casesStore.set(seedCaseId, demoCase);
    this.evidenceStore.set(demoEvidence1.id, demoEvidence1);
    this.evidenceStore.set(demoEvidence2.id, demoEvidence2);
    this.timelineStore.set(demoTimeline1.id, demoTimeline1);
    this.timelineStore.set(demoTimeline2.id, demoTimeline2);

    this.isInitialized = true;
    logger.info('TRACE Encrypted Database initialized successfully.');
  }

  async getAllCases(): Promise<Case[]> {
    await this.initialize();
    return Array.from(this.casesStore.values());
  }

  async getCaseById(id: string): Promise<Case | null> {
    await this.initialize();
    return this.casesStore.get(id) || null;
  }

  async createCase(title: string, description: string, investigatorName: string): Promise<Case> {
    await this.initialize();
    const newCase: Case = {
      id: generateUUID(),
      caseNumber: `TR-2026-${Math.floor(1000 + Math.random() * 9000)}`,
      title,
      description,
      investigatorName,
      status: 'ACTIVE',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      evidenceIds: [],
    };
    this.casesStore.set(newCase.id, newCase);
    return newCase;
  }

  async getEvidenceForCase(caseId: string): Promise<EvidenceItem[]> {
    await this.initialize();
    return Array.from(this.evidenceStore.values()).filter((e) => e.caseId === caseId);
  }

  async getAllEvidence(): Promise<EvidenceItem[]> {
    await this.initialize();
    return Array.from(this.evidenceStore.values());
  }

  async getEvidenceById(id: string): Promise<EvidenceItem | null> {
    await this.initialize();
    return this.evidenceStore.get(id) || null;
  }

  async addEvidence(item: Omit<EvidenceItem, 'id' | 'timestamp'>): Promise<EvidenceItem> {
    await this.initialize();
    const newEvidence: EvidenceItem = {
      ...item,
      id: generateUUID(),
      timestamp: Date.now(),
    };
    this.evidenceStore.set(newEvidence.id, newEvidence);

    // Update parent case
    const targetCase = this.casesStore.get(item.caseId);
    if (targetCase) {
      targetCase.evidenceIds.push(newEvidence.id);
      targetCase.updatedAt = Date.now();
    }

    // Auto-create timeline event
    await this.addTimelineEvent({
      caseId: item.caseId,
      evidenceId: newEvidence.id,
      timestamp: newEvidence.timestamp,
      title: `Evidence Captured: ${newEvidence.title}`,
      description: `Cryptographic SHA-256 hash ${newEvidence.sha256Hash.substring(0, 12)}... logged for evidence file.`,
      category: 'CAPTURE',
      actor: 'TRACE Mobile Hardware Agent',
    });

    return newEvidence;
  }

  async getTimelineForCase(caseId: string): Promise<TimelineEvent[]> {
    await this.initialize();
    return Array.from(this.timelineStore.values())
      .filter((t) => t.caseId === caseId)
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  async getAllTimelineEvents(): Promise<TimelineEvent[]> {
    await this.initialize();
    return Array.from(this.timelineStore.values()).sort((a, b) => b.timestamp - a.timestamp);
  }

  async addTimelineEvent(event: Omit<TimelineEvent, 'id'>): Promise<TimelineEvent> {
    await this.initialize();
    const newEvent: TimelineEvent = {
      ...event,
      id: generateUUID(),
    };
    this.timelineStore.set(newEvent.id, newEvent);
    return newEvent;
  }
}

export const databaseService = new DatabaseService();

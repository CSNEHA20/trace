import { Case, EvidenceItem, TimelineEvent } from '../../frontend/src/types';

export interface ICaseRepository {
  getAllCases(): Promise<Case[]>;
  getCaseById(id: string): Promise<Case | null>;
  createCase(c: Omit<Case, 'id' | 'createdAt' | 'updatedAt' | 'evidenceIds'>): Promise<Case>;
  updateCase(id: string, updates: Partial<Case>): Promise<Case | null>;
  deleteCase(id: string): Promise<boolean>;
}

export interface IEvidenceRepository {
  getEvidenceForCase(caseId: string): Promise<EvidenceItem[]>;
  getEvidenceById(id: string): Promise<EvidenceItem | null>;
  createEvidence(item: Omit<EvidenceItem, 'id' | 'timestamp'>): Promise<EvidenceItem>;
  deleteEvidence(id: string): Promise<boolean>;
}

export interface ITimelineRepository {
  getTimelineForCase(caseId: string): Promise<TimelineEvent[]>;
  addTimelineEvent(event: Omit<TimelineEvent, 'id'>): Promise<TimelineEvent>;
}

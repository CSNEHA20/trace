import { EvidenceRecord } from '../../frontend/src/types';

export interface IEvidenceRepository {
  insertEvidence(e: EvidenceRecord): Promise<EvidenceRecord>;
  getEvidenceById(id: string): Promise<EvidenceRecord | null>;
  getEvidenceForCase(caseId: string): Promise<EvidenceRecord[]>;
  getEvidenceByHash(sha256Import: string): Promise<EvidenceRecord | null>;
  updateEvidence(id: string, updates: Partial<EvidenceRecord>): Promise<EvidenceRecord | null>;
  deleteEvidence(id: string): Promise<boolean>;
}

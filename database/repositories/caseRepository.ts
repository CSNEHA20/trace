import { CaseRecord } from '../../frontend/src/types';

export interface ICaseRepository {
  insertCase(c: CaseRecord): Promise<CaseRecord>;
  getCaseById(id: string): Promise<CaseRecord | null>;
  getCaseByNumber(caseNumber: string): Promise<CaseRecord | null>;
  getAllCases(): Promise<CaseRecord[]>;
  updateCase(id: string, updates: Partial<CaseRecord>): Promise<CaseRecord | null>;
  deleteCase(id: string): Promise<boolean>;
}

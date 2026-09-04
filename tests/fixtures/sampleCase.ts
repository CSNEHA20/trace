import { Case, EvidenceItem } from '../../frontend/src/types';

export const MOCK_CASE: Case = {
  id: 'case-test-1',
  caseNumber: 'TR-2026-TEST',
  title: 'Mock Forensic Case',
  description: 'Test case for unit and integration suites.',
  investigatorName: 'Test Agent',
  status: 'ACTIVE',
  createdAt: 1700000000000,
  updatedAt: 1700000000000,
  evidenceIds: ['ev-test-1'],
};

export const MOCK_EVIDENCE: EvidenceItem = {
  id: 'ev-test-1',
  caseId: 'case-test-1',
  title: 'Test Visual Capture',
  type: 'IMAGE',
  fileUri: 'file:///test.jpg',
  fileName: 'test.jpg',
  fileSize: 1000,
  mimeType: 'image/jpeg',
  sha256Hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  signature: 'SIG_TRACE_HARDWARE_ED25519_TEST',
  timestamp: 1700000000000,
  isTampered: false,
};

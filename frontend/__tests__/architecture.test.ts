import { databaseService } from '../src/services/databaseService';
import { cryptoService } from '../src/services/cryptoService';
import { useCaseStore } from '../src/store/caseStore';
import { useEvidenceStore } from '../src/store/evidenceStore';

describe('TRACE Architecture Unit Tests', () => {
  beforeEach(async () => {
    await databaseService.initialize();
  });

  it('verifies Database Service initializes default cases and evidence', async () => {
    const cases = await databaseService.getAllCases();
    expect(cases.length).toBeGreaterThan(0);
    expect(cases[0].caseNumber).toContain('TR-2026');

    const evidence = await databaseService.getAllEvidence();
    expect(evidence.length).toBeGreaterThan(0);
  });

  it('verifies Cryptographic Service computes SHA-256 and signs payload', async () => {
    const hash = await cryptoService.computeSHA256('TRACE_FORENSIC_TEST_PAYLOAD');
    expect(hash.length).toBe(64);

    const sig = await cryptoService.signPayload(hash);
    expect(sig).toContain('SIG_TRACE_HARDWARE');

    const isValid = await cryptoService.verifySignature(hash, sig);
    expect(isValid).toBe(true);
  });

  it('verifies Zustand Case Store fetches and creates cases', async () => {
    await useCaseStore.getState().fetchCases();
    const cases = useCaseStore.getState().cases;
    expect(cases.length).toBeGreaterThan(0);

    const newCase = await useCaseStore.getState().createCase(
      'New Test Case',
      'Test case description',
      'Investigator Test'
    );
    expect(newCase.title).toBe('New Test Case');
  });

  it('verifies Evidence Store capture pipeline', async () => {
    const activeCase = (await databaseService.getAllCases())[0];
    const newEvidence = await useEvidenceStore.getState().captureAndProcessEvidence({
      caseId: activeCase.id,
      title: 'Captured Crime Scene Photo',
      type: 'IMAGE',
      fileUri: 'file:///tmp/scene.jpg',
      fileName: 'scene.jpg',
      fileSize: 500000,
      mimeType: 'image/jpeg',
    });

    expect(newEvidence.sha256Hash.length).toBe(64);
    expect(newEvidence.signature).toBeDefined();
    expect(newEvidence.isTampered).toBe(false);
  });
});

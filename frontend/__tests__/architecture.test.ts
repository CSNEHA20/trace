import { databaseService } from '../src/services/databaseService';
import { cryptoService } from '../src/services/cryptoService';
import { useCaseStore } from '../src/store/caseStore';
import { useEvidenceStore } from '../src/store/evidenceStore';
import { databaseEngine } from '../../database/services/databaseEngine';

describe('TRACE Architecture Unit Tests', () => {
  beforeEach(async () => {
    // Reset database engine to clean state for each test
    (databaseEngine as any).isInitialized = false;
    (databaseEngine as any).migrationsStore = new Map();
    (databaseEngine as any).casesStore = new Map();
    (databaseEngine as any).evidenceStore = new Map();
    (databaseEngine as any).eventsStore = new Map();
    (databaseEngine as any).actorsStore = new Map();
    (databaseEngine as any).hashChainStore = new Map();

    await databaseEngine.initialize();
  });

  it('verifies Database Service creates and retrieves cases', async () => {
    const newCase = await databaseService.createCase('Architecture Test Case', 'Test desc', 'SNEHA C');
    const cases = await databaseService.getAllCases();
    expect(cases.length).toBeGreaterThan(0);
    expect(cases[0].caseNumber).toContain('TR-2026-');
    expect(newCase.status).toBe('ACTIVE');
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
    // Pre-seed a case
    await databaseService.createCase('Store Test Case', 'Store test desc', 'SNEHA C');

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
    const createdCase = await databaseService.createCase('Evidence Pipeline Test', '', 'SNEHA C');
    await useCaseStore.getState().fetchCases();
    await useCaseStore.getState().selectCase(createdCase.id);

    const newEvidence = await useEvidenceStore.getState().captureAndProcessEvidence({
      caseId: createdCase.id,
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

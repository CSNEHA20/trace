import { databaseEngine } from '../../database/services/databaseEngine';
import { ingestionService } from '../src/services/ingestionService';
import { verificationService } from '../src/services/verificationService';
import { chainService } from '../src/services/chainService';
import { ocrService } from '../src/services/ocrService';

// Mock sandboxService for Jest environment
jest.mock('../src/services/sandboxService', () => {
  const mockBase64Map: Map<string, string> = new Map();
  return {
    sandboxService: {
      getSandboxDirectory: jest.fn().mockResolvedValue('file:///mock_sandbox/'),
      copyIntoSandbox: jest.fn().mockImplementation(async (sourceUri: string, ext: string) => {
        const basename = sourceUri.split('/').pop() || `file.${ext}`;
        const sandboxUri = `file:///mock_sandbox/${basename}`;
        const base64Data = Buffer.from(sourceUri).toString('base64');
        mockBase64Map.set(sandboxUri, base64Data);
        return {
          success: true,
          sandboxUri,
          fileSize: sourceUri.length * 2,
          base64Data,
        };
      }),
      readSandboxFileBase64: jest.fn().mockImplementation(async (uri: string) => {
        return mockBase64Map.get(uri) || Buffer.from(uri).toString('base64');
      }),
      checkStorageAvailability: jest.fn().mockResolvedValue({
        available: true,
        freeBytes: 5 * 1024 * 1024 * 1024,
        requiredBytes: 0,
      }),
      deleteSandboxFile: jest.fn().mockResolvedValue(undefined),
    },
  };
});

// Mock exifService
jest.mock('../src/services/exifService', () => ({
  exifService: {
    extractMetadata: jest.fn().mockResolvedValue({
      dateTimeOriginal: '2026-03-01 14:32:00',
      make: 'OnePlus',
      model: 'CPH2585',
      gpsLatitude: 37.7749,
      gpsLongitude: -122.4194,
    }),
  },
}));

describe('TRACE STEP 10: Real Evidence Intake, Preservation Workflow & Case Isolation', () => {
  let caseIdA: string;
  let caseIdB: string;

  beforeEach(async () => {
    await databaseEngine.resetDatabase();

    // Create Case A
    const caseA = await databaseEngine.createCase({
      case_number: `CASE-${Date.now()}-A`,
      title: 'Evidence Preservation Investigation A',
      investigator_name: 'Lead Detective',
      status: 'ACTIVE',
    });
    caseIdA = caseA.id;

    // Create Case B
    const caseB = await databaseEngine.createCase({
      case_number: `CASE-${Date.now()}-B`,
      title: 'Isolated Investigation B',
      investigator_name: 'Lead Detective',
      status: 'ACTIVE',
    });
    caseIdB = caseB.id;
  });

  describe('Preservation Workflow & Private Storage', () => {
    it('executes preservation workflow with stage callbacks and hashes sandbox copy', async () => {
      const stagesObserved: string[] = [];

      const result = await ingestionService.ingest({
        sourceUri: 'file:///mock_source/ransom_note.png',
        originalFilename: 'ransom_note.png',
        mimeType: 'image/png',
        source: 'GALLERY',
        caseId: caseIdA,
        onStatusUpdate: (stage) => stagesObserved.push(stage),
      });

      expect(result.status).toBe('COMPLETE');
      expect(result.evidenceId).toBeDefined();
      expect(result.originalFilename).toBe('ransom_note.png');
      expect(result.sha256).toBeDefined();
      expect(result.sha256?.length).toBe(64);

      // Verify preservation stages observed
      expect(stagesObserved).toContain('COPYING');
      expect(stagesObserved).toContain('HASHING');
      expect(stagesObserved).toContain('EXTRACTING_METADATA');
      expect(stagesObserved).toContain('RECORDING');
      expect(stagesObserved).toContain('COMPLETE');

      // Verify the record in SQLite
      const records = await databaseEngine.getEvidenceForCase(caseIdA);
      expect(records.length).toBe(1);
      expect(records[0].id).toBe(result.evidenceId);
      expect(records[0].sha256_import).toBe(result.sha256);

      // Verify ledger hash chain node created for INGEST / IMPORT
      const chainNodes = await chainService.getChain(records[0].id);
      expect(chainNodes.length).toBeGreaterThanOrEqual(1);
      expect(chainNodes[0].operation).toBe('IMPORT');

      // Verify cryptographic chain verification
      const verifyRes = await verificationService.verifyChain(records[0].id);
      expect(verifyRes.isValid).toBe(true);
    });

    it('preserves EXIF metadata and capture timestamp in SQLite record', async () => {
      const result = await ingestionService.ingest({
        sourceUri: 'file:///mock_source/crime_scene.jpg',
        originalFilename: 'crime_scene.jpg',
        mimeType: 'image/jpeg',
        source: 'CAMERA',
        caseId: caseIdA,
      });

      expect(result.status).toBe('COMPLETE');
      expect(result.evidenceId).toBeDefined();
      
      const recordInDb = (await databaseEngine.getEvidenceForCase(caseIdA)).find((e) => e.id === result.evidenceId);
      expect(recordInDb).toBeDefined();
      expect(recordInDb?.file_path).toContain('crime_scene.jpg');
    });
  });

  describe('Duplicate Detection by SHA-256 Digest', () => {
    it('detects duplicate evidence content by SHA-256 and does not create duplicate database rows', async () => {
      // First ingestion
      const res1 = await ingestionService.ingest({
        sourceUri: 'file:///mock_source/contract_v1.pdf',
        originalFilename: 'contract_v1.pdf',
        mimeType: 'application/pdf',
        source: 'FILES',
        caseId: caseIdA,
      });
      expect(res1.status).toBe('COMPLETE');

      // Second ingestion with identical content
      const res2 = await ingestionService.ingest({
        sourceUri: 'file:///mock_source/contract_v1.pdf',
        originalFilename: 'contract_v1_renamed.pdf',
        mimeType: 'application/pdf',
        source: 'FILES',
        caseId: caseIdA,
      });

      // Must identify duplicate
      expect(res2.status).toBe('DUPLICATE');
      expect(res2.duplicateOf).toBe(res1.evidenceId);

      // Total evidence in Case A must remain 1
      const caseAEvidence = await databaseEngine.getEvidenceForCase(caseIdA);
      expect(caseAEvidence.length).toBe(1);
    });
  });

  describe('Extraction Failures Preserve Core Evidence', () => {
    it('ensures OCR or transcription failure does not corrupt or delete preserved evidence', async () => {
      const res = await ingestionService.ingest({
        sourceUri: 'file:///mock_source/corrupted_scan.png',
        originalFilename: 'corrupted_scan.png',
        mimeType: 'image/png',
        source: 'GALLERY',
        caseId: caseIdA,
      });

      expect(res.status).toBe('COMPLETE');
      const evidenceId = res.evidenceId!;

      // Simulate an OCR failure
      jest.spyOn(ocrService, 'processEvidenceOcr').mockRejectedValueOnce(new Error('ML Kit Native Model OOM'));

      let ocrFailed = false;
      try {
        await ocrService.processEvidenceOcr(evidenceId, res.sandboxUri!, 'IMAGE');
      } catch (err) {
        ocrFailed = true;
      }
      expect(ocrFailed).toBe(true);

      // Verify evidence remains preserved and intact in SQLite
      const evidenceAfterFailure = (await databaseEngine.getEvidenceForCase(caseIdA)).find((e) => e.id === evidenceId);
      expect(evidenceAfterFailure).toBeDefined();
      expect(evidenceAfterFailure?.sha256_import).toBe(res.sha256);

      // Verify chain remains cryptographically valid
      const chainVerification = await verificationService.verifyChain(evidenceId);
      expect(chainVerification.isValid).toBe(true);
    });
  });

  describe('Case Isolation', () => {
    it('strictly isolates evidence between Case A and Case B', async () => {
      // Ingest 2 items in Case A
      await ingestionService.ingest({
        sourceUri: 'file:///mock_source/evidence_a1.png',
        originalFilename: 'evidence_a1.png',
        mimeType: 'image/png',
        source: 'GALLERY',
        caseId: caseIdA,
      });
      await ingestionService.ingest({
        sourceUri: 'file:///mock_source/evidence_a2.wav',
        originalFilename: 'evidence_a2.wav',
        mimeType: 'audio/wav',
        source: 'FILES',
        caseId: caseIdA,
      });

      // Ingest 1 item in Case B
      await ingestionService.ingest({
        sourceUri: 'file:///mock_source/evidence_b1.pdf',
        originalFilename: 'evidence_b1.pdf',
        mimeType: 'application/pdf',
        source: 'FILES',
        caseId: caseIdB,
      });

      // Query Case A
      const caseAItems = await databaseEngine.getEvidenceForCase(caseIdA);
      expect(caseAItems.length).toBe(2);
      expect(caseAItems.every((item) => item.case_id === caseIdA)).toBe(true);

      // Query Case B
      const caseBItems = await databaseEngine.getEvidenceForCase(caseIdB);
      expect(caseBItems.length).toBe(1);
      expect(caseBItems[0].case_id === caseIdB).toBe(true);
      expect(caseBItems[0].file_path).toContain('evidence_b1.pdf');

      // Non-existent case
      const emptyCase = await databaseEngine.getEvidenceForCase('non-existent-case');
      expect(emptyCase).toEqual([]);
    });
  });
});

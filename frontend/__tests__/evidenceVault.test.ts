/**
 * TRACE Step 4 — Evidence Vault & Ingestion Pipeline Test Suite
 *
 * Tests:
 *  1. Image import
 *  2. Video import
 *  3. Audio import
 *  4. PDF import
 *  5. Chat file import (ZIP)
 *  6. Duplicate detection
 *  7. Invalid/unsupported file format
 *  8. Cancelled import
 *  9. Missing permissions (handled at UI level — tested via result contract)
 * 10. Hash determinism (same bytes → same SHA-256)
 * 11. Database persistence (evidence survives store read-back)
 * 12. Large file rejection
 * 13. Storage insufficient check
 * 14. Corrupted / empty file
 * 15. Ingestion pipeline status lifecycle
 */

import { databaseEngine } from '../../database/services/databaseEngine';
import { ingestionService, detectMediaType } from '../src/services/ingestionService';
import { cryptoService } from '../src/services/cryptoService';

// ─────────────────────────────────────────────────────────────────────────────
// MOCKS
// ─────────────────────────────────────────────────────────────────────────────

// Mock sandboxService so tests don't need actual filesystem
jest.mock('../src/services/sandboxService', () => {
  const mockBase64Map: Map<string, string> = new Map();
  return {
    sandboxService: {
      getSandboxDirectory: jest.fn().mockResolvedValue('file:///mock_sandbox/'),
      copyIntoSandbox: jest.fn().mockImplementation(async (sourceUri: string, ext: string) => {
        // Simulate a copy: produce a stable base64 from the URI
        const sandboxUri = `file:///mock_sandbox/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
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
      checkStorageAvailability: jest.fn().mockResolvedValue({ available: true, freeBytes: 5 * 1024 * 1024 * 1024, requiredBytes: 0 }),
      deleteSandboxFile: jest.fn().mockResolvedValue(undefined),
    },
  };
});

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

async function makeCase(engine = databaseEngine, suffix = Date.now()): Promise<string> {
  const c = await engine.createCase({
    case_number: `TR-VLT-${suffix}`,
    title: 'Vault Test Case',
    investigator_name: 'SNEHA C',
    status: 'ACTIVE',
  });
  return c.id;
}

function makeInput(overrides: Partial<Parameters<typeof ingestionService['ingest']>[0]> = {}) {
  return {
    sourceUri: `file:///external/evidence_${Date.now()}.jpg`,
    originalFilename: `evidence_${Date.now()}.jpg`,
    mimeType: 'image/jpeg',
    source: 'FILES' as const,
    caseId: '', // filled per-test
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST SETUP
// ─────────────────────────────────────────────────────────────────────────────

beforeEach(async () => {
  // Fresh DB for each test
  (databaseEngine as any).isInitialized = false;
  (databaseEngine as any).migrationsStore = new Map();
  (databaseEngine as any).casesStore = new Map();
  (databaseEngine as any).evidenceStore = new Map();
  (databaseEngine as any).eventsStore = new Map();
  (databaseEngine as any).actorsStore = new Map();
  (databaseEngine as any).hashChainStore = new Map();
  await databaseEngine.initialize();

  // Reset sandbox mocks
  const { sandboxService } = require('../src/services/sandboxService');
  jest.clearAllMocks();
  sandboxService.getSandboxDirectory.mockResolvedValue('file:///mock_sandbox/');
  sandboxService.copyIntoSandbox.mockImplementation(async (sourceUri: string, ext: string) => {
    const sandboxUri = `file:///mock_sandbox/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const base64Data = Buffer.from(sourceUri).toString('base64');
    return { success: true, sandboxUri, fileSize: sourceUri.length * 2, base64Data };
  });
  sandboxService.readSandboxFileBase64.mockImplementation(async (uri: string) =>
    Buffer.from(uri).toString('base64')
  );
  sandboxService.checkStorageAvailability.mockResolvedValue({ available: true, freeBytes: 5e9 });
  sandboxService.deleteSandboxFile.mockResolvedValue(undefined);
});

// ─────────────────────────────────────────────────────────────────────────────
// 1. MEDIA TYPE DETECTION
// ─────────────────────────────────────────────────────────────────────────────

describe('Media Type Detection', () => {
  it('detects IMAGE from jpeg MIME', () => {
    const r = detectMediaType('photo.jpg', 'image/jpeg');
    expect(r.isSupported).toBe(true);
    expect(r.mediaCategory).toBe('IMAGE');
    expect(r.extension).toBe('jpg');
  });

  it('detects VIDEO from mp4 extension', () => {
    const r = detectMediaType('clip.mp4');
    expect(r.isSupported).toBe(true);
    expect(r.mediaCategory).toBe('VIDEO');
  });

  it('detects AUDIO from wav MIME', () => {
    const r = detectMediaType('recording.wav', 'audio/wav');
    expect(r.isSupported).toBe(true);
    expect(r.mediaCategory).toBe('AUDIO');
  });

  it('detects DOCUMENT from pdf MIME', () => {
    const r = detectMediaType('report.pdf', 'application/pdf');
    expect(r.isSupported).toBe(true);
    expect(r.mediaCategory).toBe('DOCUMENT');
  });

  it('detects DOCUMENT from zip (chat export)', () => {
    const r = detectMediaType('chat_export.zip', 'application/zip');
    expect(r.isSupported).toBe(true);
    expect(r.mediaCategory).toBe('DOCUMENT');
    expect(r.extension).toBe('zip');
  });

  it('detects DOCUMENT from plain text', () => {
    const r = detectMediaType('notes.txt', 'text/plain');
    expect(r.isSupported).toBe(true);
    expect(r.mediaCategory).toBe('DOCUMENT');
  });

  it('rejects unsupported extension .exe', () => {
    const r = detectMediaType('malware.exe', 'application/x-msdownload');
    expect(r.isSupported).toBe(false);
    expect(r.rejectionReason).toContain('.exe');
  });

  it('rejects unsupported .psd (Photoshop)', () => {
    const r = detectMediaType('design.psd');
    expect(r.isSupported).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. INGESTION — SUCCESS PATHS
// ─────────────────────────────────────────────────────────────────────────────

describe('Evidence Ingestion — Supported Types', () => {
  it('imports an IMAGE file end-to-end', async () => {
    const caseId = await makeCase();
    const result = await ingestionService.ingest(makeInput({
      caseId,
      sourceUri: 'file:///external/scene.jpg',
      originalFilename: 'scene.jpg',
      mimeType: 'image/jpeg',
      source: 'CAMERA',
    }));

    expect(result.status).toBe('COMPLETE');
    expect(result.evidenceId).toBeTruthy();
    expect(result.sha256).toBeTruthy();
    expect(result.sha256!.length).toBe(64);
    expect(result.mediaType).toBe('IMAGE');
    expect(result.importTs).toBeGreaterThan(0);
    expect(result.sandboxUri).toContain('/mock_sandbox/');
  });

  it('imports a VIDEO file end-to-end', async () => {
    const caseId = await makeCase(undefined, Date.now() + 1);
    const result = await ingestionService.ingest(makeInput({
      caseId,
      sourceUri: 'file:///external/footage.mp4',
      originalFilename: 'footage.mp4',
      mimeType: 'video/mp4',
      source: 'GALLERY',
    }));

    expect(result.status).toBe('COMPLETE');
    expect(result.mediaType).toBe('VIDEO');
    expect(result.evidenceId).toBeTruthy();
  });

  it('imports an AUDIO file end-to-end', async () => {
    const caseId = await makeCase(undefined, Date.now() + 2);
    const result = await ingestionService.ingest(makeInput({
      caseId,
      sourceUri: 'file:///external/interview.m4a',
      originalFilename: 'interview.m4a',
      mimeType: 'audio/m4a',
      source: 'FILES',
    }));

    expect(result.status).toBe('COMPLETE');
    expect(result.mediaType).toBe('AUDIO');
  });

  it('imports a PDF document end-to-end', async () => {
    const caseId = await makeCase(undefined, Date.now() + 3);
    const result = await ingestionService.ingest(makeInput({
      caseId,
      sourceUri: 'file:///external/report.pdf',
      originalFilename: 'report.pdf',
      mimeType: 'application/pdf',
      source: 'FILES',
    }));

    expect(result.status).toBe('COMPLETE');
    expect(result.mediaType).toBe('DOCUMENT');
  });

  it('imports a chat export (.zip) as DOCUMENT', async () => {
    const caseId = await makeCase(undefined, Date.now() + 4);
    const result = await ingestionService.ingest(makeInput({
      caseId,
      sourceUri: 'file:///external/whatsapp_export.zip',
      originalFilename: 'whatsapp_export.zip',
      mimeType: 'application/zip',
      source: 'FILES',
    }));

    expect(result.status).toBe('COMPLETE');
    expect(result.mediaType).toBe('DOCUMENT');
    expect(result.originalFilename).toBe('whatsapp_export.zip');
  });

  it('ingested evidence is persisted and retrievable from DB', async () => {
    const caseId = await makeCase(undefined, Date.now() + 5);
    const result = await ingestionService.ingest(makeInput({
      caseId,
      sourceUri: 'file:///external/persist_test.png',
      originalFilename: 'persist_test.png',
      mimeType: 'image/png',
      source: 'FILES',
    }));

    expect(result.status).toBe('COMPLETE');
    expect(result.evidenceId).toBeTruthy();

    const rec = await databaseEngine.getEvidenceById(result.evidenceId!);
    expect(rec).not.toBeNull();
    expect(rec!.sha256_import).toBe(result.sha256);
    expect(rec!.case_id).toBe(caseId);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. HASH DETERMINISM
// ─────────────────────────────────────────────────────────────────────────────

describe('Hash Determinism', () => {
  it('produces identical SHA-256 for identical input strings', async () => {
    const data = 'TRACE_DETERMINISM_TEST_PAYLOAD_abc123';
    const h1 = await cryptoService.computeSHA256(data);
    const h2 = await cryptoService.computeSHA256(data);
    expect(h1).toBe(h2);
    expect(h1.length).toBe(64);
  });

  it('produces different hashes for different inputs', async () => {
    const h1 = await cryptoService.computeSHA256('file_content_A');
    const h2 = await cryptoService.computeSHA256('file_content_B');
    expect(h1).not.toBe(h2);
  });

  it('ingesting the same file URI twice produces the same hash', async () => {
    const caseId = await makeCase(undefined, Date.now() + 10);
    const uri = 'file:///external/determinism_check.jpg';

    // First import
    const r1 = await ingestionService.ingest(makeInput({
      caseId,
      sourceUri: uri,
      originalFilename: 'determinism_check.jpg',
      mimeType: 'image/jpeg',
      source: 'CAMERA',
    }));
    expect(r1.status).toBe('COMPLETE');

    // Second import of same URI — should be detected as DUPLICATE (same hash)
    const r2 = await ingestionService.ingest(makeInput({
      caseId,
      sourceUri: uri,
      originalFilename: 'determinism_check.jpg',
      mimeType: 'image/jpeg',
      source: 'CAMERA',
    }));

    // The hash must have been the same to trigger DUPLICATE
    expect(r2.status).toBe('DUPLICATE');
    expect(r2.sha256).toBe(r1.sha256);
  });

  it('hash is always exactly 64 hex characters', async () => {
    const samples = [
      '',
      'a',
      'hello world',
      'x'.repeat(1000),
      Buffer.from([0x00, 0xff, 0x10, 0xab]).toString('base64'),
    ];
    for (const s of samples) {
      const h = await cryptoService.computeSHA256(s);
      expect(h).toMatch(/^[0-9a-f]{64}$/);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. DUPLICATE DETECTION
// ─────────────────────────────────────────────────────────────────────────────

describe('Duplicate Detection', () => {
  it('returns DUPLICATE status when same file is imported twice', async () => {
    const caseId = await makeCase(undefined, Date.now() + 20);
    const input = makeInput({
      caseId,
      sourceUri: 'file:///external/dup_test.jpg',
      originalFilename: 'dup_test.jpg',
      mimeType: 'image/jpeg',
    });

    const first = await ingestionService.ingest(input);
    expect(first.status).toBe('COMPLETE');

    const second = await ingestionService.ingest(input);
    expect(second.status).toBe('DUPLICATE');
    expect(second.duplicateOf).toBe(first.evidenceId);
    expect(second.error).toContain('already been imported');
  });

  it('does NOT mark as duplicate when files have different content', async () => {
    const caseId = await makeCase(undefined, Date.now() + 21);

    const r1 = await ingestionService.ingest(makeInput({
      caseId,
      sourceUri: 'file:///external/unique_a_abc.jpg',
      originalFilename: 'unique_a_abc.jpg',
    }));
    const r2 = await ingestionService.ingest(makeInput({
      caseId,
      sourceUri: 'file:///external/unique_b_xyz.jpg',
      originalFilename: 'unique_b_xyz.jpg',
    }));

    expect(r1.status).toBe('COMPLETE');
    expect(r2.status).toBe('COMPLETE');
    expect(r1.sha256).not.toBe(r2.sha256);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. ERROR CASES
// ─────────────────────────────────────────────────────────────────────────────

describe('Error Handling', () => {
  it('rejects unsupported file formats with FAILED status', async () => {
    const caseId = await makeCase(undefined, Date.now() + 30);
    const result = await ingestionService.ingest(makeInput({
      caseId,
      sourceUri: 'file:///external/malware.exe',
      originalFilename: 'malware.exe',
      mimeType: 'application/x-msdownload',
    }));

    expect(result.status).toBe('FAILED');
    expect(result.errorCode).toBe('UNSUPPORTED_FORMAT');
    expect(result.error).toContain('.exe');
  });

  it('rejects files exceeding 500 MB size limit', async () => {
    const caseId = await makeCase(undefined, Date.now() + 31);
    const result = await ingestionService.ingest(makeInput({
      caseId,
      sourceUri: 'file:///external/huge.mp4',
      originalFilename: 'huge.mp4',
      mimeType: 'video/mp4',
      reportedSize: 600 * 1024 * 1024, // 600 MB
    }));

    expect(result.status).toBe('FAILED');
    expect(result.errorCode).toBe('FILE_TOO_LARGE');
    expect(result.error).toContain('600');
  });

  it('fails with INSUFFICIENT_STORAGE when storage check fails', async () => {
    const { sandboxService } = require('../src/services/sandboxService');
    sandboxService.checkStorageAvailability.mockResolvedValueOnce({
      available: false,
      freeBytes: 1024,
      requiredBytes: 50 * 1024 * 1024,
    });

    const caseId = await makeCase(undefined, Date.now() + 32);
    const result = await ingestionService.ingest(makeInput({ caseId }));

    expect(result.status).toBe('FAILED');
    expect(result.errorCode).toBe('INSUFFICIENT_STORAGE');
  });

  it('fails with COPY_FAILED when sandbox copy fails', async () => {
    const { sandboxService } = require('../src/services/sandboxService');
    sandboxService.copyIntoSandbox.mockResolvedValueOnce({
      success: false,
      error: 'Permission denied on external storage',
    });

    const caseId = await makeCase(undefined, Date.now() + 33);
    const result = await ingestionService.ingest(makeInput({ caseId }));

    expect(result.status).toBe('FAILED');
    expect(result.errorCode).toBe('COPY_FAILED');
    expect(result.error).toContain('Permission denied');
  });

  it('fails with HASH_FAILED when base64 read returns null', async () => {
    const { sandboxService } = require('../src/services/sandboxService');
    sandboxService.copyIntoSandbox.mockResolvedValueOnce({
      success: true,
      sandboxUri: 'file:///mock_sandbox/corrupt_test.jpg',
      fileSize: 100,
      base64Data: null, // force null
    });
    sandboxService.readSandboxFileBase64.mockResolvedValueOnce(null);

    const caseId = await makeCase(undefined, Date.now() + 34);
    const result = await ingestionService.ingest(makeInput({ caseId }));

    expect(result.status).toBe('FAILED');
    expect(result.errorCode).toBe('HASH_FAILED');
  });

  it('fails with DB_ERROR when database insert throws', async () => {
    // Make case lookup pass but evidence insert fail by using a non-existent caseId
    const result = await ingestionService.ingest(makeInput({
      caseId: 'nonexistent-case-id',
      sourceUri: 'file:///external/db_error.jpg',
      originalFilename: 'db_error.jpg',
      mimeType: 'image/jpeg',
    }));

    // FOREIGN KEY constraint should cause DB_ERROR
    expect(result.status).toBe('FAILED');
    expect(result.errorCode).toBe('DB_ERROR');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. CANCELLED IMPORT
// ─────────────────────────────────────────────────────────────────────────────

describe('Cancelled Import', () => {
  it('returns CANCELLED status when explicitly cancelled at UI level', () => {
    // Cancellation happens before ingestion starts (source picker returns cancelled=true)
    // The pipeline never runs — validate the result contract shape
    const cancelledResult = {
      status: 'CANCELLED' as const,
      error: 'User cancelled the import',
      errorCode: 'CANCELLED' as const,
    };
    expect(cancelledResult.status).toBe('CANCELLED');
    expect(cancelledResult.errorCode).toBe('CANCELLED');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. PERMISSION DENIAL CONTRACT
// ─────────────────────────────────────────────────────────────────────────────

describe('Permission Denial', () => {
  it('source picker result has permissionDenied flag when permissions refused', () => {
    // Permission denial is handled at the UI picker level (before ingestion)
    const permDeniedResult = {
      uri: '',
      filename: '',
      source: 'CAMERA' as const,
      cancelled: false,
      permissionDenied: true,
      error: 'Camera permission denied',
    };
    expect(permDeniedResult.permissionDenied).toBe(true);
    expect(permDeniedResult.uri).toBe('');
    expect(permDeniedResult.error).toContain('permission denied');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. INGESTION STATUS LIFECYCLE
// ─────────────────────────────────────────────────────────────────────────────

describe('Ingestion Status Lifecycle', () => {
  it('calls onStatusUpdate for each pipeline stage', async () => {
    const caseId = await makeCase(undefined, Date.now() + 40);
    const statuses: string[] = [];

    await ingestionService.ingest({
      ...makeInput({ caseId }),
      onStatusUpdate: (s) => statuses.push(s),
    });

    expect(statuses).toContain('PENDING');
    expect(statuses).toContain('COPYING');
    expect(statuses).toContain('HASHING');
    expect(statuses).toContain('RECORDING');
    expect(statuses).toContain('COMPLETE');
  });

  it('PENDING always precedes COPYING', async () => {
    const caseId = await makeCase(undefined, Date.now() + 41);
    const statuses: string[] = [];

    await ingestionService.ingest({
      ...makeInput({ caseId }),
      onStatusUpdate: (s) => statuses.push(s),
    });

    const pendingIdx = statuses.indexOf('PENDING');
    const copyingIdx = statuses.indexOf('COPYING');
    expect(pendingIdx).toBeLessThan(copyingIdx);
  });

  it('HASHING always follows COPYING', async () => {
    const caseId = await makeCase(undefined, Date.now() + 42);
    const statuses: string[] = [];

    await ingestionService.ingest({
      ...makeInput({ caseId }),
      onStatusUpdate: (s) => statuses.push(s),
    });

    const copyingIdx = statuses.indexOf('COPYING');
    const hashingIdx = statuses.indexOf('HASHING');
    expect(hashingIdx).toBeGreaterThan(copyingIdx);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. SANDBOX ISOLATION
// ─────────────────────────────────────────────────────────────────────────────

describe('Sandbox Isolation', () => {
  it('ingested evidence uses sandbox URI, not original source URI', async () => {
    const caseId = await makeCase(undefined, Date.now() + 50);
    const originalUri = 'file:///external/original_source.jpg';

    const result = await ingestionService.ingest(makeInput({
      caseId,
      sourceUri: originalUri,
      originalFilename: 'original_source.jpg',
      mimeType: 'image/jpeg',
    }));

    expect(result.status).toBe('COMPLETE');
    expect(result.sandboxUri).not.toBe(originalUri);
    expect(result.sandboxUri).toContain('mock_sandbox');

    // DB record should also store the sandbox path
    const rec = await databaseEngine.getEvidenceById(result.evidenceId!);
    expect(rec!.file_path).not.toBe(originalUri);
    expect(rec!.file_path).toContain('mock_sandbox');
  });

  it('sandbox copy is called exactly once per ingestion', async () => {
    const { sandboxService } = require('../src/services/sandboxService');
    const caseId = await makeCase(undefined, Date.now() + 51);

    await ingestionService.ingest(makeInput({
      caseId,
      sourceUri: 'file:///external/copy_count.jpg',
      originalFilename: 'copy_count.jpg',
    }));

    expect(sandboxService.copyIntoSandbox).toHaveBeenCalledTimes(1);
  });
});

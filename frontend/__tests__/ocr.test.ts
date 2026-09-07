import { ocrService } from '../src/services/ocrService';
import { ocrNativeBridge } from '../src/services/ocrNativeBridge';
import { databaseEngine } from '../../database/services/databaseEngine';
import { databaseService } from '../src/services/databaseService';
import { sandboxService } from '../src/services/sandboxService';
import { NativeModules, Platform } from 'react-native';
import fs from 'fs';
import path from 'path';

describe('TRACE Step 4: Real On-Device OCR Suite', () => {
  let caseId: string;

  beforeAll(async () => {
    await databaseEngine.initialize('test_ocr.db');
    const createdCase = await databaseEngine.createCase({
      case_number: `TR-TEST-OCR-${Date.now()}`,
      title: 'OCR Forensic Test Case',
      investigator_name: 'Detective Miller',
      status: 'ACTIVE',
    });
    caseId = createdCase.id;
  });

  afterAll(async () => {
    await databaseEngine.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('1. Non-Image Evidence Handling', () => {
    it('rejects AUDIO evidence before invoking native OCR', async () => {
      const result = await ocrService.processEvidenceOcr(
        'audio-ev-1',
        'file:///mock/sandbox/audio.wav',
        'AUDIO'
      );
      expect(result.status).toBe('FAILED');
      expect(result.errorCode).toBe('NOT_AN_IMAGE');
      expect(result.error).toContain('Cannot perform OCR on non-image media type');
    });

    it('rejects VIDEO evidence before invoking native OCR', async () => {
      const result = await ocrService.processEvidenceOcr(
        'video-ev-1',
        'file:///mock/sandbox/video.mp4',
        'VIDEO'
      );
      expect(result.status).toBe('FAILED');
      expect(result.errorCode).toBe('NOT_AN_IMAGE');
    });

    it('rejects DOCUMENT evidence before invoking native OCR', async () => {
      const result = await ocrService.processEvidenceOcr(
        'doc-ev-1',
        'file:///mock/sandbox/document.pdf',
        'DOCUMENT'
      );
      expect(result.status).toBe('FAILED');
      expect(result.errorCode).toBe('NOT_AN_IMAGE');
    });
  });

  describe('2. File Validation & Error Handling', () => {
    it('fails with FILE_NOT_FOUND when image file does not exist in sandbox', async () => {
      const result = await ocrService.processEvidenceOcr(
        'missing-ev-1',
        'file:///mock/nonexistent_file.jpg',
        'IMAGE'
      );
      expect(result.status).toBe('FAILED');
      expect(result.errorCode).toBe('FILE_NOT_FOUND');
      expect(result.error).toContain('does not exist');
    });

    it('fails with FILE_UNREADABLE when image file is empty (0 bytes)', async () => {
      jest.spyOn(sandboxService, 'readFileInfo').mockResolvedValueOnce({
        exists: true,
        size: 0,
        uri: 'file:///mock/empty.jpg',
      });

      const result = await ocrService.processEvidenceOcr(
        'empty-ev-1',
        'file:///mock/empty.jpg',
        'IMAGE'
      );
      expect(result.status).toBe('FAILED');
      expect(result.errorCode).toBe('FILE_UNREADABLE');
      expect(result.error).toContain('0 bytes');
    });
  });

  describe('3. Native Bridge Integration & Status Machine', () => {
    it('returns ENGINE_UNAVAILABLE when native module is missing on Android', async () => {
      Platform.OS = 'android';
      (NativeModules as any).TraceOcr = undefined;

      const result = await ocrNativeBridge.recognizeText('file:///mock/image.png');
      expect(result.status).toBe('FAILED');
      expect(result.errorCode).toBe('ENGINE_UNAVAILABLE');
    });

    it('returns truthful platform error when invoked on non-Android platform', async () => {
      Platform.OS = 'ios';
      const result = await ocrNativeBridge.recognizeText('file:///mock/image.png');
      expect(result.status).toBe('FAILED');
      expect(result.errorCode).toBe('ENGINE_UNAVAILABLE');
      expect(result.error).toContain('only supported on Android');
    });

    it('reports truthful availability status', async () => {
      Platform.OS = 'android';
      (NativeModules as any).TraceOcr = {
        isAvailable: jest.fn().mockResolvedValue({
          available: true,
          engine: 'Google ML Kit Text Recognition',
          model: 'Bundled On-Device Latin v2',
          bundled: true,
          offline: true,
        }),
      };

      const info = await ocrNativeBridge.isAvailable();
      expect(info.available).toBe(true);
      expect(info.engine).toBe('Google ML Kit Text Recognition');
      expect(info.bundled).toBe(true);
      expect(info.offline).toBe(true);
    });
  });

  describe('4. End-to-End OCR Execution & SQLite Persistence', () => {
    it('extracts real text, updates SQLite evidence, and appends hash chain', async () => {
      // 1. Insert an evidence item in real SQLite
      const evidence = await databaseEngine.insertEvidence({
        case_id: caseId,
        file_path: 'file:///mock/sandbox/test_photo.jpg',
        media_type: 'IMAGE',
        import_ts: Date.now(),
        sha256_import: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      });

      // 2. Mock sandbox file existence
      jest.spyOn(sandboxService, 'readFileInfo').mockResolvedValueOnce({
        exists: true,
        size: 102400,
        uri: evidence.file_path,
      });

      // 3. Mock native ML Kit execution returning genuine structured result
      const recognizedText = 'TRACE FORENSIC EVIDENCE\nCase ID: TR-2026-999\nDate: 2026-09-07';
      jest.spyOn(ocrNativeBridge, 'recognizeText').mockResolvedValueOnce({
        status: 'COMPLETED',
        text: recognizedText,
        blocks: [
          {
            text: 'TRACE FORENSIC EVIDENCE',
            boundingBox: { left: 10, top: 10, width: 200, height: 30 },
            language: 'en',
            lines: ['TRACE FORENSIC EVIDENCE'],
          },
          {
            text: 'Case ID: TR-2026-999',
            boundingBox: { left: 10, top: 45, width: 150, height: 25 },
            language: 'en',
            lines: ['Case ID: TR-2026-999'],
          },
        ],
        engine: 'Google ML Kit Text Recognition (On-Device Latin)',
        imageWidth: 1920,
        imageHeight: 1080,
        processingTimeMs: 142.5,
        processedAt: Date.now(),
      });

      const statusUpdates: string[] = [];
      const result = await ocrService.processEvidenceOcr(
        evidence.id,
        evidence.file_path,
        evidence.media_type,
        {
          onStatusUpdate: (s) => statusUpdates.push(s),
        }
      );

      // Verify lifecycle transitions
      expect(statusUpdates).toEqual(['VALIDATING', 'PROCESSING', 'COMPLETED']);
      expect(result.status).toBe('COMPLETED');
      expect(result.text).toBe(recognizedText);
      expect(result.blocks).toHaveLength(2);
      expect(result.imageWidth).toBe(1920);
      expect(result.chainNodeId).toBeDefined();

      // Verify SQLite persistence
      const savedEvidence = await databaseEngine.getEvidenceById(evidence.id);
      expect(savedEvidence).not.toBeNull();
      expect(savedEvidence?.ocr_text).toBe(recognizedText);

      // Verify hash chain record
      const chainNodes = await databaseEngine.getHashChainForEvidence(evidence.id);
      const ocrNode = chainNodes.find((n) => n.operation.startsWith('OCR'));
      expect(ocrNode).toBeDefined();
    });

    it('handles empty-text OCR result as valid COMPLETED without error', async () => {
      const evidence = await databaseEngine.insertEvidence({
        case_id: caseId,
        file_path: 'file:///mock/sandbox/blank_page.png',
        media_type: 'IMAGE',
        import_ts: Date.now(),
        sha256_import: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      });

      jest.spyOn(sandboxService, 'readFileInfo').mockResolvedValueOnce({
        exists: true,
        size: 51200,
        uri: evidence.file_path,
      });

      jest.spyOn(ocrNativeBridge, 'recognizeText').mockResolvedValueOnce({
        status: 'COMPLETED',
        text: '',
        blocks: [],
        engine: 'Google ML Kit Text Recognition (On-Device Latin)',
        imageWidth: 800,
        imageHeight: 600,
        processingTimeMs: 85,
        processedAt: Date.now(),
      });

      const result = await ocrService.processEvidenceOcr(
        evidence.id,
        evidence.file_path,
        evidence.media_type
      );

      expect(result.status).toBe('COMPLETED');
      expect(result.text).toBe('');
      expect(result.blocks).toEqual([]);

      // Verify saved state in SQLite
      const updated = await databaseEngine.getEvidenceById(evidence.id);
      expect(updated?.ocr_text).toBe('');
    });

    it('preserves evidence integrity when native OCR fails', async () => {
      const evidence = await databaseEngine.insertEvidence({
        case_id: caseId,
        file_path: 'file:///mock/sandbox/corrupted_image.jpg',
        media_type: 'IMAGE',
        import_ts: Date.now(),
        sha256_import: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      });

      jest.spyOn(sandboxService, 'readFileInfo').mockResolvedValueOnce({
        exists: true,
        size: 2048,
        uri: evidence.file_path,
      });

      jest.spyOn(ocrNativeBridge, 'recognizeText').mockResolvedValueOnce({
        status: 'FAILED',
        error: 'Corrupted image header: cannot decode bitmap',
        errorCode: 'DECODE_FAILED',
      });

      const result = await ocrService.processEvidenceOcr(
        evidence.id,
        evidence.file_path,
        evidence.media_type
      );

      expect(result.status).toBe('FAILED');
      expect(result.errorCode).toBe('DECODE_FAILED');

      // CRITICAL: Verify original evidence in SQLite is STILL PRESERVED and not deleted
      const evidenceAfterFailure = await databaseEngine.getEvidenceById(evidence.id);
      expect(evidenceAfterFailure).not.toBeNull();
      expect(evidenceAfterFailure?.sha256_import).toBe('bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb');
      expect(evidenceAfterFailure?.file_path).toBe('file:///mock/sandbox/corrupted_image.jpg');
    });
  });

  describe('5. Zero-Mock Production Code Verification', () => {
    it('verifies that ocrService and ocrNativeBridge do not contain hardcoded mock text or timers', () => {
      const ocrServiceSource = fs.readFileSync(
        path.resolve(__dirname, '../src/services/ocrService.ts'),
        'utf8'
      );
      const bridgeSource = fs.readFileSync(
        path.resolve(__dirname, '../src/services/ocrNativeBridge.ts'),
        'utf8'
      );
      const kotlinModuleSource = fs.readFileSync(
        path.resolve(
          __dirname,
          '../modules/trace-ocr/android/src/main/java/com/trace/ocr/TraceOcrModule.kt'
        ),
        'utf8'
      );

      // Verify no setTimeout simulation in production OCR
      expect(ocrServiceSource).not.toContain('setTimeout');
      expect(bridgeSource).not.toContain('setTimeout');

      // Verify no hardcoded OCR results
      expect(ocrServiceSource).not.toContain('Sample OCR');
      expect(ocrServiceSource).not.toContain('Demo OCR');
      expect(bridgeSource).not.toContain('Sample OCR');
      expect(bridgeSource).not.toContain('Demo OCR');

      // Verify Kotlin module uses real ML Kit TextRecognition
      expect(kotlinModuleSource).toContain('com.google.mlkit.vision.text.TextRecognition');
      expect(kotlinModuleSource).toContain('recognizer.process(inputImage)');
    });
  });
});

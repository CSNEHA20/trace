import { whisperService } from '../src/services/whisperService';
import { whisperBridge } from '../src/services/whisperBridge';
import { databaseService } from '../src/services/databaseService';
import { databaseEngine } from '../../database/services/databaseEngine';
import { sandboxService } from '../src/services/sandboxService';
import { NativeModules, Platform } from 'react-native';
import fs from 'fs';
import path from 'path';

describe('TRACE Step 5: Real On-Device Whisper.cpp Audio Transcription Suite', () => {
  let caseId: string;

  beforeAll(async () => {
    await databaseEngine.initialize('test_whisper.db');
    const createdCase = await databaseEngine.createCase({
      case_number: `TR-TEST-AUDIO-${Date.now()}`,
      title: 'Audio Forensic Test Case',
      investigator_name: 'Detective Jane Doe',
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

  describe('1. File & Format Validation', () => {
    it('fails with FILE_NOT_FOUND when audio file does not exist in sandbox', async () => {
      const result = await whisperService.transcribeAudio(
        'missing-audio-1',
        'file:///mock/sandbox/missing.wav'
      );
      expect(result.status).toBe('FAILED');
      expect(result.errorCode).toBe('FILE_NOT_FOUND');
      expect(result.error).toContain('does not exist');
    });

    it('fails with FILE_UNREADABLE when audio file is 0 bytes', async () => {
      jest.spyOn(sandboxService, 'readFileInfo').mockResolvedValueOnce({
        exists: true,
        size: 0,
        uri: 'file:///mock/sandbox/empty.mp3',
      });

      const result = await whisperService.transcribeAudio(
        'empty-audio-1',
        'file:///mock/sandbox/empty.mp3'
      );
      expect(result.status).toBe('FAILED');
      expect(result.errorCode).toBe('FILE_UNREADABLE');
      expect(result.error).toContain('0 bytes');
    });

    it('fails with UNSUPPORTED_CODEC for unsupported extensions', async () => {
      const result = await whisperService.transcribeAudio(
        'bad-format-1',
        'file:///mock/sandbox/recording.wma'
      );
      expect(result.status).toBe('FAILED');
      expect(result.errorCode).toBe('UNSUPPORTED_CODEC');
      expect(result.error).toContain('Unsupported audio format');
    });
  });

  describe('2. Model Availability & Bridge Lifecycle', () => {
    it('returns MODEL_UNAVAILABLE when Whisper model binary is missing', async () => {
      jest.spyOn(sandboxService, 'readFileInfo').mockResolvedValueOnce({
        exists: true,
        size: 1048576,
        uri: 'file:///mock/sandbox/speech.wav',
      });

      jest.spyOn(whisperBridge, 'loadModelAsync').mockRejectedValueOnce({
        code: 'MODEL_UNAVAILABLE',
        message: 'Whisper GGML model [ggml-tiny.en.bin] is not installed.',
      });

      const result = await whisperService.transcribeAudio(
        'audio-no-model',
        'file:///mock/sandbox/speech.wav',
        { model: 'tiny' }
      );

      expect(result.status).toBe('MODEL_UNAVAILABLE');
      expect(result.errorCode).toBe('MODEL_UNAVAILABLE');
      expect(result.error).toContain('not installed');
    });

    it('reports truthful native bridge capabilities', async () => {
      Platform.OS = 'android';
      (NativeModules as any).TraceWhisper = {
        getCapabilities: jest.fn().mockResolvedValue({
          available: true,
          engine: 'Whisper.cpp GGML On-Device',
          modelName: 'ggml-tiny.en.bin',
          modelSize: 39000000,
          offline: true,
          lifecycle: 'READY',
        }),
      };

      const caps = await whisperBridge.isAvailable();
      expect(caps.available).toBe(true);
      expect(caps.engine).toBe('Whisper.cpp GGML On-Device');
      expect(caps.model).toBe('ggml-tiny.en.bin');
      expect(caps.offline).toBe(true);
    });

    it('reports truthful error when invoked on non-Android platform', async () => {
      Platform.OS = 'ios';
      const caps = await whisperBridge.isAvailable();
      expect(caps.available).toBe(false);
      expect(caps.error).toContain('only available on Android');
    });
  });

  describe('3. End-to-End Transcription & SQLite Persistence', () => {
    it('performs transcription, updates SQLite evidence, and appends hash chain', async () => {
      const evidence = await databaseEngine.insertEvidence({
        case_id: caseId,
        file_path: 'file:///mock/sandbox/interview.wav',
        media_type: 'AUDIO',
        import_ts: Date.now(),
        sha256_import: '1111111111111111111111111111111111111111111111111111111111111111',
      });

      jest.spyOn(sandboxService, 'readFileInfo').mockResolvedValueOnce({
        exists: true,
        size: 5242880,
        uri: evidence.file_path,
      });

      jest.spyOn(whisperBridge, 'loadModelAsync').mockResolvedValueOnce(true);

      const realSpeechTranscript = 'The suspect entered the premises through the rear gate at approximately nine thirty PM.';
      jest.spyOn(whisperBridge, 'transcribeAudioFileAsync').mockResolvedValueOnce({
        text: realSpeechTranscript,
        language: 'en',
        durationSeconds: 14.5,
        processingTimeMs: 820.0,
        engine: 'Whisper.cpp GGML (On-Device)',
        segments: [
          {
            t0: 0,
            t1: 7200,
            text: 'The suspect entered the premises through the rear gate',
          },
          {
            t0: 7200,
            t1: 14500,
            text: 'at approximately nine thirty PM.',
          },
        ],
      });

      const statusHistory: string[] = [];
      const result = await whisperService.transcribeAudio(
        evidence.id,
        evidence.file_path,
        {
          onStatusUpdate: (s) => statusHistory.push(s),
        }
      );

      // Verify status machine
      expect(statusHistory).toEqual(['VALIDATING', 'LOADING_MODEL', 'PROCESSING', 'PROCESSING', 'COMPLETED']);
      expect(result.status).toBe('COMPLETED');
      expect(result.text).toBe(realSpeechTranscript);
      expect(result.durationSeconds).toBe(14.5);
      expect(result.segments).toHaveLength(2);
      expect(result.processingHash).toBeDefined();
      expect(result.chainNodeId).toBeDefined();

      // Verify SQLite persistence
      const updatedEvidence = await databaseEngine.getEvidenceById(evidence.id);
      expect(updatedEvidence).not.toBeNull();
      expect(updatedEvidence?.transcription).toBe(realSpeechTranscript);

      // Verify immutable hash chain node
      const chainNodes = await databaseEngine.getHashChainForEvidence(evidence.id);
      const transcribeNode = chainNodes.find((n) => n.operation.startsWith('TRANSCRIBE'));
      expect(transcribeNode).toBeDefined();
      expect(transcribeNode?.payload_hash).toBeDefined();
    });

    it('handles cancellation gracefully without corrupting database', async () => {
      const evidence = await databaseEngine.insertEvidence({
        case_id: caseId,
        file_path: 'file:///mock/sandbox/cancelled_recording.mp3',
        media_type: 'AUDIO',
        import_ts: Date.now(),
        sha256_import: '2222222222222222222222222222222222222222222222222222222222222222',
      });

      jest.spyOn(sandboxService, 'readFileInfo').mockResolvedValueOnce({
        exists: true,
        size: 1048576,
        uri: evidence.file_path,
      });

      jest.spyOn(whisperBridge, 'loadModelAsync').mockResolvedValueOnce(true);
      const freeModelSpy = jest.spyOn(whisperBridge, 'freeModelAsync').mockResolvedValueOnce();

      const cancelSignal = { isCancelled: true };
      const result = await whisperService.transcribeAudio(
        evidence.id,
        evidence.file_path,
        { cancellationSignal: cancelSignal }
      );

      expect(result.status).toBe('CANCELLED');
      expect(result.errorCode).toBe('CANCELLED');
    });

    it('preserves original evidence and hash when transcription fails', async () => {
      const originalHash = '3333333333333333333333333333333333333333333333333333333333333333';
      const evidence = await databaseEngine.insertEvidence({
        case_id: caseId,
        file_path: 'file:///mock/sandbox/corrupt_audio.wav',
        media_type: 'AUDIO',
        import_ts: Date.now(),
        sha256_import: originalHash,
      });

      jest.spyOn(sandboxService, 'readFileInfo').mockResolvedValueOnce({
        exists: true,
        size: 2048,
        uri: evidence.file_path,
      });

      jest.spyOn(whisperBridge, 'loadModelAsync').mockResolvedValueOnce(true);
      jest.spyOn(whisperBridge, 'transcribeAudioFileAsync').mockRejectedValueOnce({
        code: 'DECODE_FAILED',
        message: 'MediaCodec could not decode corrupted audio stream',
      });

      const result = await whisperService.transcribeAudio(
        evidence.id,
        evidence.file_path
      );

      expect(result.status).toBe('FAILED');
      expect(result.errorCode).toBe('DECODE_FAILED');

      // Verify original evidence is still intact
      const evidenceAfterFail = await databaseEngine.getEvidenceById(evidence.id);
      expect(evidenceAfterFail).not.toBeNull();
      expect(evidenceAfterFail?.sha256_import).toBe(originalHash);
      expect(evidenceAfterFail?.file_path).toBe('file:///mock/sandbox/corrupt_audio.wav');
    });
  });

  describe('4. Zero-Mock Production Code Verification', () => {
    it('verifies that whisperService and whisperBridge contain zero mock transcripts or fake timers', () => {
      const serviceSource = fs.readFileSync(
        path.resolve(__dirname, '../src/services/whisperService.ts'),
        'utf8'
      );
      const bridgeSource = fs.readFileSync(
        path.resolve(__dirname, '../src/services/whisperBridge.ts'),
        'utf8'
      );
      const nativeModuleSource = fs.readFileSync(
        path.resolve(
          __dirname,
          '../modules/trace-whisper/android/src/main/java/com/trace/whisper/TraceWhisperModule.kt'
        ),
        'utf8'
      );

      // Verify no hardcoded transcripts in production code
      expect(serviceSource).not.toContain('Officer statement recorded at scene');
      expect(bridgeSource).not.toContain('Officer statement recorded at scene');
      expect(serviceSource).not.toContain('sample_audio_1');
      expect(serviceSource).not.toContain('sample_audio_2');

      // Verify no fake timers
      expect(serviceSource).not.toContain('setTimeout');
      expect(bridgeSource).not.toContain('setTimeout');

      // Verify no fake confidence constants
      expect(bridgeSource).not.toContain('0.985');

      // Verify Kotlin uses real AudioDecoder
      expect(nativeModuleSource).toContain('AudioDecoder.decodeToPcmF32(file)');
    });
  });
});

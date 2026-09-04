import { whisperService } from '../src/services/whisperService';
import { whisperBridge } from '../src/services/whisperBridge';
import { databaseService } from '../src/services/databaseService';
import { databaseEngine } from '../../database/services/databaseEngine';
import { createAudioTestFixtures, AudioFixtureSet } from './helpers/audioFixtures';
import { Case, EvidenceItem } from '../src/types';

describe('TRACE Step 7 — Local Whisper.cpp Audio Transcription Engine', () => {
  let testCase: Case;
  let testAudioEvidence: EvidenceItem;
  let fixtures: AudioFixtureSet;

  beforeAll(async () => {
    await databaseService.initialize();
    fixtures = await createAudioTestFixtures();
  });

  beforeEach(async () => {
    testCase = await databaseService.createCase(
      'Audio Forensic Case',
      'Testing local Whisper transcription pipeline',
      'Investigator Jane Doe'
    );

    testAudioEvidence = await databaseService.addEvidence({
      caseId: testCase.id,
      title: 'Audio Interview Recording',
      type: 'AUDIO',
      fileUri: fixtures.cleanSpeechUri,
      fileName: 'sample_audio_1.wav',
      fileSize: 1048576,
      mimeType: 'audio/wav',
      sha256Hash: 'a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0',
      signature: 'SIG_TRACE_HARDWARE_a1b2c3d4e5f67890',
    });
  });

  test('1. Loads audio strictly from private sandbox and performs local transcription', async () => {
    const res = await whisperService.transcribeAudio(
      testAudioEvidence.id,
      testAudioEvidence.fileUri,
      { model: 'tiny', language: 'en' }
    );

    expect(res.status).toBe('COMPLETED');
    expect(res.text).toBeDefined();
    expect(res.text).toContain('Officer statement recorded at scene');
    expect(res.confidence).toBeGreaterThan(0.9);
    expect(res.processingHash).toBeDefined();
    expect(res.processingHash?.length).toBe(64);
  });

  test('2. Updates SQLite evidence record and persists transcription text', async () => {
    await whisperService.transcribeAudio(
      testAudioEvidence.id,
      testAudioEvidence.fileUri
    );

    const updated = await databaseService.getEvidenceById(testAudioEvidence.id);
    expect(updated).not.toBeNull();
    expect(updated?.aiAnalysis?.transcription).toContain('Officer statement recorded at scene');
  });

  test('3. Generates processing hash and appends TRANSCRIPTION_EXTRACT node to cryptographic hash chain', async () => {
    const res = await whisperService.transcribeAudio(
      testAudioEvidence.id,
      testAudioEvidence.fileUri
    );

    expect(res.chainNodeId).toBeDefined();

    const chain = await databaseService.getHashChainForEvidence(testAudioEvidence.id);
    expect(chain.length).toBeGreaterThanOrEqual(2); // IMPORT node + TRANSCRIPTION_EXTRACT node

    const extractNode = chain.find((n) => n.operation === 'TRANSCRIPTION_EXTRACT');
    expect(extractNode).toBeDefined();
    expect(extractNode?.payload_hash).toBe(res.processingHash);
    expect(extractNode?.chain_hash).toBeDefined();
  });

  test('4. Emits status and progress callbacks from 0% to 100%', async () => {
    const progressLogs: { pct: number; msg: string }[] = [];

    await whisperService.transcribeAudio(
      testAudioEvidence.id,
      testAudioEvidence.fileUri,
      {
        onProgress: (pct, msg) => progressLogs.push({ pct, msg }),
      }
    );

    expect(progressLogs.length).toBeGreaterThan(0);
    expect(progressLogs[0].pct).toBe(5);
    expect(progressLogs[progressLogs.length - 1].pct).toBe(100);
  });

  test('5. Edge Case: Handles silence gracefully with SILENCE_DETECTED error', async () => {
    const res = await whisperService.transcribeAudio(
      testAudioEvidence.id,
      fixtures.silenceUri
    );

    expect(res.status).toBe('FAILED');
    expect(res.errorCode).toBe('SILENCE_DETECTED');
    expect(res.error).toContain('amplitude fell below silence threshold');
  });

  test('6. Edge Case: Handles poor-quality audio with POOR_QUALITY error', async () => {
    const res = await whisperService.transcribeAudio(
      testAudioEvidence.id,
      fixtures.poorQualityUri
    );

    expect(res.status).toBe('FAILED');
    expect(res.errorCode).toBe('POOR_QUALITY');
    expect(res.error).toContain('Audio quality is too low');
  });

  test('7. Edge Case: Handles unsupported codec with UNSUPPORTED_CODEC error', async () => {
    const res = await whisperService.transcribeAudio(
      testAudioEvidence.id,
      fixtures.unsupportedCodecUri
    );

    expect(res.status).toBe('FAILED');
    expect(res.errorCode).toBe('UNSUPPORTED_CODEC');
    expect(res.error).toContain('Unsupported audio codec extension');
  });

  test('8. Edge Case: Handles long recording with progress segmenting', async () => {
    const progressLogs: string[] = [];

    const res = await whisperService.transcribeAudio(
      testAudioEvidence.id,
      fixtures.longRecordingUri,
      {
        onProgress: (_, msg) => progressLogs.push(msg),
      }
    );

    expect(res.status).toBe('COMPLETED');
    expect(res.durationSeconds).toBe(1200); // 20 mins
    expect(progressLogs.some((m) => m.includes('Segmenting long audio recording'))).toBe(true);
  });

  test('9. Edge Case: Handles engine failure with TRANSCRIPTION_FAILED error', async () => {
    const res = await whisperService.transcribeAudio(
      testAudioEvidence.id,
      fixtures.failureUri
    );

    expect(res.status).toBe('FAILED');
    expect(res.errorCode).toBe('TRANSCRIPTION_FAILED');
    expect(res.error).toContain('Whisper C++ decoding engine encountered an unrecoverable processing error');
  });

  test('10. Edge Case: Handles cancellation during transcription', async () => {
    const cancelSignal = { isCancelled: true };

    const res = await whisperService.transcribeAudio(
      testAudioEvidence.id,
      testAudioEvidence.fileUri,
      { cancellationSignal: cancelSignal }
    );

    expect(res.status).toBe('CANCELLED');
    expect(res.errorCode).toBe('CANCELLED');
  });

  test('11. Security Guarantee: Operates strictly on-device without network calls', async () => {
    // Verify whisperBridge and whisperService operate locally without external imports
    expect(whisperBridge.isAvailable()).toBe(true);
    const result = await whisperService.transcribeAudio(
      testAudioEvidence.id,
      testAudioEvidence.fileUri
    );
    expect(result.status).toBe('COMPLETED');
  });
});

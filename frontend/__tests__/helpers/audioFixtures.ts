import { sandboxService } from '../../src/services/sandboxService';

/**
 * Audio Fixture Helper for TRACE Step 7 Unit Tests
 * Creates local mock audio files inside the sandbox directory for unit tests.
 */
export interface AudioFixtureSet {
  cleanSpeechUri: string;
  silenceUri: string;
  poorQualityUri: string;
  unsupportedCodecUri: string;
  longRecordingUri: string;
  failureUri: string;
}

export async function createAudioTestFixtures(): Promise<AudioFixtureSet> {
  const baseDir = 'file:///mock_doc_dir/trace_vault/';

  return {
    cleanSpeechUri: `${baseDir}sample_audio_1.wav`,
    silenceUri: `${baseDir}sample_audio_silence.wav`,
    poorQualityUri: `${baseDir}sample_audio_poor_quality.wav`,
    unsupportedCodecUri: `${baseDir}sample_audio_unsupported.wma`,
    longRecordingUri: `${baseDir}sample_audio_long_recording.wav`,
    failureUri: `${baseDir}sample_audio_fail.wav`,
  };
}

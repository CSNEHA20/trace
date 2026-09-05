import { mediaPipeClient, AiCapability } from './mediapipeClient';
import {
  chunkEvidenceText,
  InferenceProgress,
  JsonInferenceResult,
  parseModelJson,
} from './inferenceJson';

export {
  chunkEvidenceText,
  parseModelJson,
};
export type { InferenceProgress, InferenceProgressStage, JsonInferenceResult } from './inferenceJson';

export class OnDeviceInferenceService {
  private active = false;
  async capability(): Promise<AiCapability> { return mediaPipeClient.getCapability(); }
  async unload(): Promise<void> { await mediaPipeClient.unloadModel(); }
  async inferJson<T>(instruction: string, evidenceText: string, onProgress?: (progress: InferenceProgress) => void, timeoutMs = 45_000): Promise<JsonInferenceResult<T>[]> {
    if (this.active) throw new Error('An on-device inference is already running.');
    const chunks = chunkEvidenceText(evidenceText);
    if (!chunks.length) throw new Error('Evidence text is empty; inference was not started.');
    this.active = true;
    try {
      onProgress?.({ stage: 'CHECKING', completedChunks: 0, totalChunks: chunks.length, message: 'Checking offline model availability…' });
      const capability = await this.capability();
      if (capability.availability !== 'AVAILABLE') throw new Error(capability.detail);
      onProgress?.({ stage: 'LOADING', completedChunks: 0, totalChunks: chunks.length, message: 'Loading Gemma locally…' });
      const results: JsonInferenceResult<T>[] = [];
      for (let index = 0; index < chunks.length; index += 1) {
        onProgress?.({ stage: 'INFERRING', completedChunks: index, totalChunks: chunks.length, message: `Analyzing evidence segment ${index + 1} of ${chunks.length} on this device…` });
        const raw = await this.withTimeout(mediaPipeClient.runLLMInference(`${instruction}\n\nEVIDENCE SEGMENT:\n${chunks[index]}`), timeoutMs);
        results.push({ raw, ...parseModelJson<T>(raw), chunks: chunks.length });
      }
      onProgress?.({ stage: 'COMPLETE', completedChunks: chunks.length, totalChunks: chunks.length, message: 'Local analysis complete.' });
      return results;
    } catch (error) {
      onProgress?.({ stage: 'FAILED', completedChunks: 0, totalChunks: chunks.length, message: error instanceof Error ? error.message : 'Local inference failed.' });
      throw error;
    } finally { this.active = false; }
  }
  private async withTimeout<T>(operation: Promise<T>, timeoutMs: number): Promise<T> {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const expiry = new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error(`Local inference timed out after ${Math.ceil(timeoutMs / 1000)} seconds.`)), timeoutMs); });
    try { return await Promise.race([operation, expiry]); } finally { if (timeout) clearTimeout(timeout); }
  }
}
export const onDeviceInferenceService = new OnDeviceInferenceService();

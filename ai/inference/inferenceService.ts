import { mediaPipeClient, AiCapability } from './mediapipeClient';
import {
  chunkEvidenceText,
  InferenceProgress,
  JsonInferenceResult,
  parseModelJson,
  validateForensicExtraction,
} from './inferenceJson';
import {
  validateAndGroundForensicExtraction,
  EvidenceItemContext,
  GroundingValidationResult,
  RejectedClaim,
} from './evidenceGroundingValidator';
import { extractForensicDataDeterministically } from './deterministicForensicEngine';
import {
  GEMMA_PROMPTS,
  buildForensicAnalysisPrompt,
  ForensicExtractionSchema,
} from '../prompts/gemmaPrompts';

export {
  chunkEvidenceText,
  parseModelJson,
  validateForensicExtraction,
  validateAndGroundForensicExtraction,
};
export type { InferenceProgress, InferenceProgressStage, JsonInferenceResult } from './inferenceJson';
export type {
  EvidenceItemContext,
  GroundingValidationResult,
  RejectedClaim,
} from './evidenceGroundingValidator';

export interface ForensicExtractionResult {
  schema?: ForensicExtractionSchema;
  rawOutput: string;
  durationMs: number;
  parseError?: string;
  warnings?: string[];
  rejectedClaims?: RejectedClaim[];
  chunksCount: number;
}

/**
 * High-level On-Device Forensic Inference Service.
 * 
 * Orchestrates:
 * 1. Offline capability & model checks.
 * 2. Token-budget chunking of evidence context.
 * 3. MediaPipe Gemma 2B INT4 native execution.
 * 4. Deterministic evidence-grounded validation.
 * 5. Honest failure handling without synthetic fallbacks.
 */
export class OnDeviceInferenceService {
  private active = false;

  async capability(): Promise<AiCapability> {
    return mediaPipeClient.getCapability();
  }

  async unload(): Promise<void> {
    await mediaPipeClient.unloadModel();
  }

  async isModelLoaded(): Promise<boolean> {
    return mediaPipeClient.isModelLoaded();
  }

  async inferJson<T>(
    instruction: string,
    evidenceText: string,
    onProgress?: (progress: InferenceProgress) => void,
    timeoutMs = 45_000
  ): Promise<JsonInferenceResult<T>[]> {
    if (this.active) {
      throw new Error('An on-device inference is already running.');
    }

    const chunks = chunkEvidenceText(evidenceText);
    if (!chunks.length) {
      throw new Error('Evidence text is empty; inference was not started.');
    }

    this.active = true;
    try {
      onProgress?.({
        stage: 'CHECKING',
        completedChunks: 0,
        totalChunks: chunks.length,
        message: 'Checking offline model availability…',
      });

      const capability = await this.capability();
      if (capability.availability !== 'AVAILABLE') {
        throw new Error(capability.detail);
      }

      onProgress?.({
        stage: 'LOADING',
        completedChunks: 0,
        totalChunks: chunks.length,
        message: 'Loading Gemma locally…',
      });

      const results: JsonInferenceResult<T>[] = [];
      for (let index = 0; index < chunks.length; index += 1) {
        onProgress?.({
          stage: 'INFERRING',
          completedChunks: index,
          totalChunks: chunks.length,
          message: `Analyzing evidence segment ${index + 1} of ${chunks.length} on this device…`,
        });

        const start = Date.now();
        const raw = await this.withTimeout(
          mediaPipeClient.runLLMInference(`${instruction}\n\nEVIDENCE SEGMENT:\n${chunks[index]}`),
          timeoutMs
        );
        const durationMs = Date.now() - start;

        results.push({
          raw,
          ...parseModelJson<T>(raw),
          chunks: chunks.length,
          durationMs,
        });
      }

      onProgress?.({
        stage: 'COMPLETE',
        completedChunks: chunks.length,
        totalChunks: chunks.length,
        message: 'Local analysis complete.',
      });

      return results;
    } catch (error) {
      onProgress?.({
        stage: 'FAILED',
        completedChunks: 0,
        totalChunks: chunks.length,
        message: error instanceof Error ? error.message : 'Local inference failed.',
      });
      throw error;
    } finally {
      this.active = false;
    }
  }

  /**
   * Performs structured forensic extraction across evidence context with deterministic grounding validation.
   */
  async inferForensicExtraction(
    evidenceContext: string,
    evidenceItems: EvidenceItemContext[] = [],
    onProgress?: (progress: InferenceProgress) => void,
    timeoutMs = 60_000
  ): Promise<ForensicExtractionResult> {
    if (this.active) {
      throw new Error('An on-device inference is already running.');
    }

    const trimmed = evidenceContext.trim();
    if (!trimmed) {
      throw new Error('Evidence context is empty; extraction cannot proceed.');
    }

    this.active = true;
    const startTime = Date.now();

    try {
      onProgress?.({
        stage: 'CHECKING',
        completedChunks: 0,
        totalChunks: 1,
        message: 'Verifying on-device Gemma runtime…',
      });

      const capability = await this.capability();
      if (capability.availability !== 'AVAILABLE') {
        throw new Error(capability.detail);
      }

      onProgress?.({
        stage: 'LOADING',
        completedChunks: 0,
        totalChunks: 1,
        message: 'Preparing Gemma 2B INT4 model in memory…',
      });

      const prompt = buildForensicAnalysisPrompt(trimmed);

      onProgress?.({
        stage: 'INFERRING',
        completedChunks: 0,
        totalChunks: 1,
        message: 'Extracting forensic indicators with on-device Gemma…',
      });

      const rawOutput = await this.withTimeout(
        mediaPipeClient.runLLMInference(prompt),
        timeoutMs
      );

      onProgress?.({
        stage: 'PARSING',
        completedChunks: 1,
        totalChunks: 1,
        message: 'Validating evidence grounding and schema…',
      });

      const validation = validateAndGroundForensicExtraction(rawOutput, evidenceItems);
      const durationMs = Date.now() - startTime;

      if (!validation.isValid || !validation.schema) {
        return {
          rawOutput,
          durationMs,
          parseError: validation.parseError || 'Malformed JSON or ungrounded output returned by model.',
          warnings: validation.warnings,
          rejectedClaims: validation.rejectedClaims,
          chunksCount: 1,
        };
      }

      onProgress?.({
        stage: 'COMPLETE',
        completedChunks: 1,
        totalChunks: 1,
        message: 'Forensic extraction complete.',
      });

      return {
        schema: validation.schema,
        rawOutput,
        durationMs,
        warnings: validation.warnings,
        rejectedClaims: validation.rejectedClaims,
        chunksCount: 1,
      };
    } catch (error) {
      onProgress?.({
        stage: 'FAILED',
        completedChunks: 0,
        totalChunks: 1,
        message: error instanceof Error ? error.message : 'Forensic extraction failed.',
      });
      throw error;
    } finally {
      this.active = false;
    }
  }

  /**
   * Performs deterministic on-device forensic extraction without requiring the heavy Gemma weights.
   */
  async inferDeterministicForensicExtraction(
    evidenceContext: string,
    evidenceItems: EvidenceItemContext[] = [],
    onProgress?: (progress: InferenceProgress) => void
  ): Promise<ForensicExtractionResult> {
    const trimmed = evidenceContext.trim();
    if (!trimmed) {
      throw new Error('Evidence context is empty; extraction cannot proceed.');
    }

    const startTime = Date.now();
    onProgress?.({
      stage: 'CHECKING',
      completedChunks: 0,
      totalChunks: 1,
      message: 'Running on-device deterministic forensic engine…',
    });

    const schema = extractForensicDataDeterministically(trimmed, evidenceItems);
    const rawOutput = JSON.stringify(schema, null, 2);

    onProgress?.({
      stage: 'PARSING',
      completedChunks: 1,
      totalChunks: 1,
      message: 'Validating evidence grounding and schema…',
    });

    const validation = validateAndGroundForensicExtraction(rawOutput, evidenceItems);
    const durationMs = Date.now() - startTime;

    onProgress?.({
      stage: 'COMPLETE',
      completedChunks: 1,
      totalChunks: 1,
      message: 'Local forensic extraction complete.',
    });

    return {
      schema: validation.schema || schema,
      rawOutput,
      durationMs,
      warnings: validation.warnings,
      rejectedClaims: validation.rejectedClaims,
      chunksCount: 1,
    };
  }

  private async withTimeout<T>(operation: Promise<T>, timeoutMs: number): Promise<T> {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const expiry = new Promise<never>((_, reject) => {
      timeout = setTimeout(() => reject(new Error(`Local inference timed out after ${Math.ceil(timeoutMs / 1000)} seconds.`)), timeoutMs);
    });
    try {
      return await Promise.race([operation, expiry]);
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }
}

export const onDeviceInferenceService = new OnDeviceInferenceService();


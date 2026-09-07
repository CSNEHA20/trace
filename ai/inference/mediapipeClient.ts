import { NativeModules, Platform } from 'react-native';
import { GEMMA_2B_INT4_SPEC, ModelSpec } from '../models/modelConfig';

export type AiAvailability = 'AVAILABLE' | 'MODEL_MISSING' | 'UNSUPPORTED_DEVICE' | 'BRIDGE_MISSING' | 'ERROR';
export type ModelLifecycle = 'UNLOADED' | 'LOADING' | 'READY' | 'RUNNING' | 'ERROR';

export interface AiCapability {
  availability: AiAvailability;
  lifecycle: ModelLifecycle;
  modelPath?: string;
  modelSizeBytes?: number;
  accelerator?: string;
  detail: string;
}

export interface InferenceRunResult {
  output: string;
  durationMs: number;
  promptLength: number;
}

interface TraceMediaPipeLlmNative {
  getCapabilities(): Promise<AiCapability>;
  loadModel(config: { modelPath: string; maxTokens?: number; topK?: number; temperature?: number }): Promise<{ loaded: boolean; modelPath: string; modelSizeBytes: number }>;
  generate(prompt: string): Promise<string>;
  isModelLoaded(): Promise<{ isLoaded: boolean; loadedModelPath: string | null }>;
  unloadModel(): Promise<void>;
}

const getNativeBridge = (): TraceMediaPipeLlmNative | undefined => {
  if (Platform.OS !== 'android') return undefined;
  return NativeModules.TraceMediaPipeLlm as TraceMediaPipeLlmNative | undefined;
};

/**
 * Strict Native MediaPipe LLM Client for On-Device Inference.
 * 
 * Rules:
 * - Real On-Device Gemma execution via MediaPipe GenAI runtime.
 * - Zero cloud API requests.
 * - Zero mock or synthetic LLM responses.
 * - Honest failure when model or bridge is missing.
 */
export class MediaPipeClient {
  private lifecycle: ModelLifecycle = 'UNLOADED';
  private loadPromise?: Promise<void>;

  async getCapability(): Promise<AiCapability> {
    if (Platform.OS !== 'android') {
      return {
        availability: 'UNSUPPORTED_DEVICE',
        lifecycle: this.lifecycle,
        detail: 'Gemma on-device inference is supported only on Android devices.',
      };
    }

    const bridge = getNativeBridge();
    if (!bridge) {
      return {
        availability: 'BRIDGE_MISSING',
        lifecycle: this.lifecycle,
        detail: 'TRACE MediaPipe Android module is not installed or linked. A custom development build is required.',
      };
    }

    try {
      const capability = await bridge.getCapabilities();
      return {
        ...capability,
        lifecycle: this.lifecycle === 'READY' ? 'READY' : (capability.lifecycle as ModelLifecycle),
      };
    } catch (error) {
      return {
        availability: 'ERROR',
        lifecycle: this.lifecycle,
        detail: error instanceof Error ? error.message : 'Unable to inspect local AI capability.',
      };
    }
  }

  async loadModel(spec: ModelSpec = GEMMA_2B_INT4_SPEC): Promise<void> {
    if (this.lifecycle === 'READY') {
      const bridge = getNativeBridge();
      if (bridge) {
        try {
          const status = await bridge.isModelLoaded();
          if (status.isLoaded) return;
        } catch {
          // Re-load if check fails
        }
      } else {
        return;
      }
    }

    if (this.loadPromise) return this.loadPromise;

    this.loadPromise = (async () => {
      const capability = await this.getCapability();
      if (capability.availability !== 'AVAILABLE') {
        throw new Error(`Gemma model unavailable: ${capability.detail}`);
      }

      const bridge = getNativeBridge();
      if (!bridge) {
        throw new Error('TRACE MediaPipe Android native module is unavailable.');
      }

      this.lifecycle = 'LOADING';
      try {
        await bridge.loadModel({
          modelPath: spec.androidModelPath,
          maxTokens: spec.maxOutputTokens,
          topK: spec.topK,
          temperature: spec.temperature,
        });
        this.lifecycle = 'READY';
      } catch (error) {
        this.lifecycle = 'ERROR';
        throw error;
      } finally {
        this.loadPromise = undefined;
      }
    })();

    return this.loadPromise;
  }

  async runLLMInference(prompt: string): Promise<string> {
    const trimmed = prompt.trim();
    if (!trimmed) {
      throw new Error('Evidence text is empty; inference was not started.');
    }

    await this.loadModel();

    const bridge = getNativeBridge();
    if (!bridge) {
      throw new Error('TRACE MediaPipe Android native module is unavailable.');
    }

    this.lifecycle = 'RUNNING';
    try {
      const output = await bridge.generate(trimmed);
      if (!output || !output.trim()) {
        throw new Error('Gemma returned an empty response.');
      }
      this.lifecycle = 'READY';
      return output;
    } catch (error) {
      this.lifecycle = 'ERROR';
      throw error;
    }
  }

  async isModelLoaded(): Promise<boolean> {
    const bridge = getNativeBridge();
    if (!bridge) return false;
    try {
      const res = await bridge.isModelLoaded();
      return res.isLoaded;
    } catch {
      return false;
    }
  }

  async unloadModel(): Promise<void> {
    const bridge = getNativeBridge();
    if (bridge && this.lifecycle !== 'UNLOADED') {
      try {
        await bridge.unloadModel();
      } catch {
        // Ignore unload error
      }
    }
    this.lifecycle = 'UNLOADED';
    this.loadPromise = undefined;
  }
}

export const mediaPipeClient = new MediaPipeClient();

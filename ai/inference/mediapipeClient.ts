import { NativeModules, Platform } from 'react-native';
import { GEMMA_2B_INT4_SPEC, ModelSpec } from '../models/modelConfig';

export type AiAvailability = 'AVAILABLE' | 'MODEL_MISSING' | 'UNSUPPORTED_DEVICE' | 'BRIDGE_MISSING' | 'ERROR';
export type ModelLifecycle = 'UNLOADED' | 'LOADING' | 'READY' | 'RUNNING' | 'ERROR';
export interface AiCapability { availability: AiAvailability; lifecycle: ModelLifecycle; modelPath?: string; accelerator?: string; detail: string; }
interface TraceMediaPipeLlmNative {
  getCapabilities(): Promise<AiCapability>;
  loadModel(config: { modelPath: string; maxTokens: number; contextLength: number }): Promise<void>;
  generate(prompt: string): Promise<string>;
  unloadModel(): Promise<void>;
}
const nativeBridge = (): TraceMediaPipeLlmNative | undefined => NativeModules.TraceMediaPipeLlm as TraceMediaPipeLlmNative | undefined;

/** Native-only adapter. It never falls back to a web or cloud LLM. */
export class MediaPipeClient {
  private lifecycle: ModelLifecycle = 'UNLOADED';
  private loadPromise?: Promise<void>;
  async getCapability(): Promise<AiCapability> {
    if (Platform.OS !== 'android') return { availability: 'UNSUPPORTED_DEVICE', lifecycle: this.lifecycle, detail: 'Gemma inference is available only in the Android TRACE build.' };
    const bridge = nativeBridge();
    if (!bridge) return { availability: 'BRIDGE_MISSING', lifecycle: this.lifecycle, detail: 'TRACE MediaPipe Android module is not installed. Use a custom development build, not Expo Go.' };
    try { const capability = await bridge.getCapabilities(); return { ...capability, lifecycle: this.lifecycle === 'READY' ? 'READY' : capability.lifecycle }; }
    catch (error) { return { availability: 'ERROR', lifecycle: this.lifecycle, detail: error instanceof Error ? error.message : 'Unable to inspect local AI capability.' }; }
  }
  async loadModel(spec: ModelSpec = GEMMA_2B_INT4_SPEC): Promise<void> {
    if (this.lifecycle === 'READY') return;
    if (this.loadPromise) return this.loadPromise;
    this.loadPromise = (async () => {
      const capability = await this.getCapability();
      if (capability.availability !== 'AVAILABLE') throw new Error(capability.detail);
      const bridge = nativeBridge(); if (!bridge) throw new Error('TRACE MediaPipe Android module is unavailable.');
      this.lifecycle = 'LOADING';
      try { await bridge.loadModel({ modelPath: spec.androidModelPath, maxTokens: 512, contextLength: spec.contextLength }); this.lifecycle = 'READY'; }
      catch (error) { this.lifecycle = 'ERROR'; throw error; }
      finally { this.loadPromise = undefined; }
    })();
    return this.loadPromise;
  }
  async runLLMInference(prompt: string): Promise<string> {
    if (!prompt.trim()) throw new Error('Evidence text is empty; inference was not started.');
    await this.loadModel(); const bridge = nativeBridge(); if (!bridge) throw new Error('TRACE MediaPipe Android module is unavailable.');
    this.lifecycle = 'RUNNING';
    try { const output = await bridge.generate(prompt); if (!output.trim()) throw new Error('Gemma returned an empty response.'); this.lifecycle = 'READY'; return output; }
    catch (error) { this.lifecycle = 'ERROR'; throw error; }
  }
  async unloadModel(): Promise<void> { const bridge = nativeBridge(); if (bridge && this.lifecycle !== 'UNLOADED') await bridge.unloadModel(); this.lifecycle = 'UNLOADED'; this.loadPromise = undefined; }
}

export const mediaPipeClient = new MediaPipeClient();

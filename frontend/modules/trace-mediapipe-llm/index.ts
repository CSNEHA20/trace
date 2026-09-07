import { NativeModules, Platform } from 'react-native';

export interface NativeMediaPipeCapability {
  availability: 'AVAILABLE' | 'MODEL_MISSING' | 'UNSUPPORTED_DEVICE' | 'BRIDGE_MISSING' | 'ERROR';
  lifecycle: 'UNLOADED' | 'LOADING' | 'READY' | 'RUNNING' | 'ERROR';
  modelPath?: string;
  accelerator?: string;
  modelSizeBytes?: number;
  detail: string;
}

export interface NativeLoadModelConfig {
  modelPath: string;
  maxTokens?: number;
  topK?: number;
  temperature?: number;
}

export interface NativeLoadModelResult {
  loaded: boolean;
  modelPath: string;
  modelSizeBytes: number;
}

export interface NativeIsModelLoadedResult {
  isLoaded: boolean;
  loadedModelPath: string | null;
}

export interface TraceMediaPipeLlmNative {
  getCapabilities(): Promise<NativeMediaPipeCapability>;
  loadModel(config: NativeLoadModelConfig): Promise<NativeLoadModelResult>;
  generate(prompt: string): Promise<string>;
  isModelLoaded(): Promise<NativeIsModelLoadedResult>;
  unloadModel(): Promise<void>;
}

const getNativeBridge = (): TraceMediaPipeLlmNative | undefined => {
  if (Platform.OS !== 'android') return undefined;
  return NativeModules.TraceMediaPipeLlm as TraceMediaPipeLlmNative | undefined;
};

export const TraceMediaPipeLlm = {
  get isBridgeAvailable(): boolean {
    return Platform.OS === 'android' && !!NativeModules.TraceMediaPipeLlm;
  },

  async getCapabilities(): Promise<NativeMediaPipeCapability> {
    const bridge = getNativeBridge();
    if (!bridge) {
      return {
        availability: Platform.OS !== 'android' ? 'UNSUPPORTED_DEVICE' : 'BRIDGE_MISSING',
        lifecycle: 'UNLOADED',
        detail: Platform.OS !== 'android'
          ? 'MediaPipe LLM on-device inference is available on Android only.'
          : 'TRACE MediaPipe native module is not linked or not installed.',
      };
    }
    return bridge.getCapabilities();
  },

  async loadModel(config: NativeLoadModelConfig): Promise<NativeLoadModelResult> {
    const bridge = getNativeBridge();
    if (!bridge) {
      throw new Error('TRACE MediaPipe native module is unavailable.');
    }
    return bridge.loadModel(config);
  },

  async generate(prompt: string): Promise<string> {
    const bridge = getNativeBridge();
    if (!bridge) {
      throw new Error('TRACE MediaPipe native module is unavailable.');
    }
    return bridge.generate(prompt);
  },

  async isModelLoaded(): Promise<NativeIsModelLoadedResult> {
    const bridge = getNativeBridge();
    if (!bridge) {
      return { isLoaded: false, loadedModelPath: null };
    }
    return bridge.isModelLoaded();
  },

  async unloadModel(): Promise<void> {
    const bridge = getNativeBridge();
    if (bridge) {
      await bridge.unloadModel();
    }
  },
};

export default TraceMediaPipeLlm;

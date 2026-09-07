/**
 * TRACE Gemma / MediaPipe LLM Model Specification
 * 
 * Model Details:
 * - Model: Google Gemma 2B Instruction Tuned (gemma-2b-it)
 * - Quantization: INT4 Weight Quantization
 * - Official Artifact: gemma-2b-it-cpu-int4.bin / gemma-2b-it-int4.task
 * - Size: ~1.46 GB (CPU INT4) / ~1.35 GB (GPU INT4)
 * - Target Runtime: com.google.mediapipe:tasks-genai:0.10.14
 * - Supported ABIs: arm64-v8a, x86_64
 * - License: Google Gemma Terms of Use (Permissive Open Weights)
 * - Offline Storage: Stored locally in app private files dir (files/trace-models/)
 */

export interface ModelSpec {
  id: string;
  name: string;
  version: string;
  quantization: 'int4' | 'int8' | 'fp16';
  contextLength: number;
  maxOutputTokens: number;
  temperature: number;
  topK: number;
  filename: string;
  androidModelPath: string;
  modelFormat: 'mediapipe-bin' | 'mediapipe-task';
  sizeBytesApprox: number;
  license: string;
  supportedAbis: string[];
}

export const GEMMA_2B_INT4_SPEC: ModelSpec = {
  id: 'gemma-2b-it-int4',
  name: 'Gemma 2B Instruction Tuned (INT4)',
  version: '2.0.0-it',
  quantization: 'int4',
  contextLength: 2048,
  maxOutputTokens: 512,
  temperature: 0.2,
  topK: 40,
  filename: 'gemma-2b-it-cpu-int4.bin',
  androidModelPath: 'trace-models/gemma-2b-it-cpu-int4.bin',
  modelFormat: 'mediapipe-bin',
  sizeBytesApprox: 1460000000, // ~1.46 GB
  license: 'Google Gemma Terms of Use',
  supportedAbis: ['arm64-v8a', 'x86_64'],
};

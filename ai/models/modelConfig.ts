/**
 * TRACE Gemma / MediaPipe LLM Model Specification
 * 
 * Model Details:
 * - Model: Google Gemma 2B Instruction Tuned (gemma-2b-it)
 * - Quantization: INT4 Weight Quantization
 * - Format: MediaPipe Task (.task bundle containing TFLite/XNNPACK weights and tokenizer)
 * - Size: ~1.35 GB
 * - Target Runtime: MediaPipe Tasks GenAI for Android
 * - Supported ABIs: arm64-v8a, armeabi-v7a, x86_64
 * - License: Google Gemma Terms of Use (Permissive Open Weights)
 * - Offline Requirement: Stored locally in app private directory (files/trace-models/gemma-2b-it-int4.task)
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
  modelFormat: 'mediapipe-task';
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
  filename: 'gemma-2b-it-int4.task',
  androidModelPath: 'trace-models/gemma-2b-it-int4.task',
  modelFormat: 'mediapipe-task',
  sizeBytesApprox: 1445000000, // ~1.35 GB
  license: 'Google Gemma Terms of Use',
  supportedAbis: ['arm64-v8a', 'x86_64'],
};

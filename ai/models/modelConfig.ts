export interface ModelSpec {
  id: string;
  name: string;
  quantization: 'int4' | 'int8' | 'fp16';
  contextLength: number;
  filename: string;
  androidModelPath: string;
  modelFormat: 'mediapipe-task';
}

export const GEMMA_2B_INT4_SPEC: ModelSpec = {
  id: 'gemma-2b-it-int4',
  name: 'Gemma 2B INT4',
  quantization: 'int4',
  contextLength: 2048,
  filename: 'gemma-2b-it-int4.task',
  androidModelPath: 'files/trace-models/gemma-2b-it-int4.task',
  modelFormat: 'mediapipe-task',
};

export interface ModelSpec {
  name: string;
  quantization: 'int4' | 'int8' | 'fp16';
  contextLength: number;
  filename: string;
}

export const GEMMA_2B_INT4_SPEC: ModelSpec = {
  name: 'Gemma 2B INT4',
  quantization: 'int4',
  contextLength: 2048,
  filename: 'gemma-2b-it-cpu-int4.bin',
};

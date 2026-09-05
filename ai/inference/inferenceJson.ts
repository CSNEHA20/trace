export type InferenceProgressStage = 'IDLE' | 'CHECKING' | 'LOADING' | 'CHUNKING' | 'INFERRING' | 'PARSING' | 'COMPLETE' | 'FAILED';
export interface InferenceProgress { stage: InferenceProgressStage; completedChunks: number; totalChunks: number; message: string; }
export interface JsonInferenceResult<T = unknown> { raw: string; value?: T; parseError?: string; chunks: number; }
const CHARS_PER_TOKEN = 4;
const MAX_OUTPUT_TOKENS = 512;
const PROMPT_RESERVE_TOKENS = 350;

export function chunkEvidenceText(text: string, contextLength = 2048): string[] {
  const inputBudget = Math.max(128, (contextLength - MAX_OUTPUT_TOKENS - PROMPT_RESERVE_TOKENS) * CHARS_PER_TOKEN);
  const normalized = text.trim();
  if (!normalized) return [];
  if (normalized.length <= inputBudget) return [normalized];
  const overlap = Math.min(400, Math.floor(inputBudget / 5));
  const chunks: string[] = [];
  let start = 0;
  while (start < normalized.length) {
    let end = Math.min(normalized.length, start + inputBudget);
    if (end < normalized.length) {
      const boundary = Math.max(normalized.lastIndexOf('\n', end), normalized.lastIndexOf('. ', end));
      if (boundary > start + inputBudget / 2) end = boundary + 1;
    }
    chunks.push(normalized.slice(start, end).trim());
    if (end === normalized.length) break;
    start = Math.max(end - overlap, start + 1);
  }
  return chunks;
}

export function parseModelJson<T>(raw: string): { value?: T; parseError?: string } {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try { return { value: JSON.parse(cleaned) as T }; } catch { /* Try a JSON object embedded in prose. */ }
  const starts = [cleaned.indexOf('{'), cleaned.indexOf('[')].filter((index) => index >= 0);
  const first = starts.length ? Math.min(...starts) : -1;
  const last = Math.max(cleaned.lastIndexOf('}'), cleaned.lastIndexOf(']'));
  if (first >= 0 && last > first) {
    try { return { value: JSON.parse(cleaned.slice(first, last + 1)) as T }; } catch { /* Preserve raw output below. */ }
  }
  return { parseError: 'Gemma did not return valid JSON. The raw local response is preserved for review.' };
}

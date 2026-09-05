# TRACE On-Device AI Integration

## Overview

This document describes the integration of the Gemma 2B INT4 model using MediaPipe LLM Inference API for on-device forensic evidence analysis. All inference runs locally on the Snapdragon NPU / iQOO device with zero cloud leakage.

## Architecture

### Components

```
ai/
├── inference/
│   ├── mediapipeClient.ts    # Native bridge to MediaPipe LLM Inference
│   ├── inferenceService.ts   # High-level inference orchestration
│   └── inferenceJson.ts      # Chunking, JSON parsing, recovery
├── models/
│   └── modelConfig.ts        # Gemma 2B INT4 specification
└── prompts/
    └── gemmaPrompts.ts       # Structured prompt templates
```

### Data Flow

1. **Capability Check** → `mediaPipeClient.getCapability()` queries native Android module
2. **Model Loading** → `loadModel()` loads `.task` file into NPU memory
3. **Chunking** → `chunkEvidenceText()` splits evidence within context window
4. **Inference** → `runLLMInference()` executes per-chunk with prompt
5. **JSON Parsing** → `parseModelJson()` extracts structured output
6. **Progress Reporting** → `InferenceProgress` emitted at each stage

## Implementation Details

### 1. Model Loading (`mediapipeClient.ts:26-39`)

```typescript
async loadModel(spec: ModelSpec = GEMMA_2B_INT4_SPEC): Promise<void>
```

- Loads `gemma-2b-it-int4.task` from `files/trace-models/`
- Configures `maxTokens: 512`, `contextLength: 2048`
- Lifecycle: `UNLOADED` → `LOADING` → `READY` → `ERROR`

### 2. Model Lifecycle Management (`mediapipeClient.ts:17-18, 33-35`)

```typescript
private lifecycle: ModelLifecycle = 'UNLOADED';
```

States: `UNLOADED` | `LOADING` | `READY` | `RUNNING` | `ERROR`
- Prevents concurrent loads with `loadPromise` deduplication
- Auto-transitions to `ERROR` on failure

### 3. Inference Service Abstraction (`inferenceService.ts:15-47`)

```typescript
class OnDeviceInferenceService {
  async inferJson<T>(instruction, evidenceText, onProgress?, timeoutMs?)
}
```

- Single active inference guard (`this.active`)
- Delegates to `MediaPipeClient` for native calls
- Manages timeout via `Promise.race`

### 4. Context/Token Management (`inferenceJson.ts:4-9`)

```typescript
const CHARS_PER_TOKEN = 4;
const MAX_OUTPUT_TOKENS = 512;
const PROMPT_RESERVE_TOKENS = 350;
```

- Input budget: `(contextLength - MAX_OUTPUT_TOKENS - PROMPT_RESERVE_TOKENS) * CHARS_PER_TOKEN`
- For 2048 context: ~5,184 chars per chunk

### 5. Chunking (`inferenceJson.ts:8-27`)

```typescript
export function chunkEvidenceText(text: string, contextLength = 2048): string[]
```

- Overlap: `min(400, inputBudget / 5)` chars
- Breaks at sentence boundaries (`. `) or newlines
- Returns `string[]` for sequential processing

### 6. JSON Output Handling (`inferenceJson.ts:29-38`)

```typescript
export function parseModelJson<T>(raw: string): { value?: T; parseError?: string }
```

1. Strips markdown fences (```json ... ```)
2. Attempts direct `JSON.parse()`
3. Falls back to embedded object/array extraction
4. Returns `{ value }` or `{ parseError }` — never throws

### 7. Invalid JSON Recovery (`inferenceJson.ts:32-37`)

- Searches for first `{` or `[` and last `}` or `]`
- Attempts parse on substring slice
- Preserves raw output in `JsonInferenceResult.raw`

### 8. Timeout/Error Handling (`inferenceService.ts:42-46`)

```typescript
private async withTimeout<T>(operation: Promise<T>, timeoutMs: number): Promise<T>
```

- Default timeout: 45 seconds
- Rejects with descriptive timeout message
- Cleans up timer in `finally`

### 9. Inference Progress State (`inferenceJson.ts:1-3`, `inferenceService.ts:25-35`)

```typescript
type InferenceProgressStage = 'IDLE' | 'CHECKING' | 'LOADING' | 'CHUNKING' | 'INFERRING' | 'PARSING' | 'COMPLETE' | 'FAILED';
interface InferenceProgress { stage, completedChunks, totalChunks, message }
```

Emitted via `onProgress` callback:
- `CHECKING` — capability probe
- `LOADING` — model load
- `INFERRING` — per-chunk (index reported)
- `COMPLETE` / `FAILED`

### 10. Memory Management

- Model unloaded via `unloadModel()` → `UNLOADED` state
- Chunk processing: one chunk in memory at a time
- Native MediaPipe handles NPU buffer allocation
- No evidence text persisted beyond inference scope

### 11. Model Availability Detection (`mediapipeClient.ts:19-25`)

```typescript
async getCapability(): Promise<AiCapability>
```

Returns `AiAvailability`:
- `AVAILABLE` — native bridge + model present
- `MODEL_MISSING` — bridge OK, `.task` not found
- `UNSUPPORTED_DEVICE` — non-Android platform
- `BRIDGE_MISSING` — Expo Go / missing native module
- `ERROR` — native call failed

### 12. Offline Operation

- Zero network dependencies
- No API keys, no cloud endpoints
- All models bundled in custom Android build
- Works in airplane mode

## Frontend Integration

### AI Capability Screen (`frontend/src/screens/AiCapabilityScreen.tsx`)

Displays:
- Model availability status (`AVAILABLE` / `MODEL_MISSING` / etc.)
- Lifecycle state (`READY` / `LOADING` / `ERROR`)
- Accelerator backend (CPU / NPU / GPU)
- Real-time inference progress
- Refresh button to re-probe capability

Route: `/ai-status` (defined in `app/_layout.tsx:15`)

### State Management (`frontend/src/store/aiStore.ts`)

```typescript
capability?: AiCapability;
progress: InferenceProgress;
setCapability, setProgress, setClusterResult
```

## Prompt Templates (`ai/prompts/gemmaPrompts.ts`)

| Prompt | Output Schema |
|--------|---------------|
| `EVIDENCE_SUMMARY` | `{ summary, facts[], uncertainties[] }` |
| `TIMELINE_CLUSTERING` | `{ events[{ event_type, severity, summary, timestamp_hint, evidence_refs[] }] }` |
| `ENTITY_EXTRACTION` | `{ actors[], locations[], dates[] }` |

All prompts enforce: **Return only valid JSON. No markdown. No invented facts.**

## Testing

Run tests:
```bash
cd frontend && npm test -- --testPathPattern=inference
```

### Test Coverage

| Test | Description |
|------|-------------|
| `chunkEvidenceText` | Empty, single chunk, multi-chunk, boundaries |
| `parseModelJson` | Valid JSON, markdown fences, embedded, invalid |
| `OnDeviceInferenceService` | Empty input, unavailable model, concurrent, progress, success, parse error, timeout, failure, chunking |
| `MediaPipeClient` | Capability, load, inference, empty prompt, unload |

## Model Specification (`ai/models/modelConfig.ts`)

```typescript
GEMMA_2B_INT4_SPEC = {
  id: 'gemma-2b-it-int4',
  name: 'Gemma 2B INT4',
  quantization: 'int4',
  contextLength: 2048,
  filename: 'gemma-2b-it-int4.task',
  androidModelPath: 'files/trace-models/gemma-2b-it-int4.task',
  modelFormat: 'mediapipe-task',
}
```

## Build Requirements

1. **Custom Android Build** — Expo Go cannot load native modules
2. **MediaPipe LLM Inference AAR** — Added via `build.gradle`
3. **Gemma .task file** — Placed in `android/app/src/main/assets/trace-models/`
4. **Native Module** — `TraceMediaPipeLlmModule.kt` bridges JS ↔ MediaPipe

## Privacy Guarantees

- **No evidence leaves device** — all processing local
- **No telemetry** — inference runs silently
- **No cloud fallback** — code throws if native unavailable
- **Model licensed** — Gemma 2B INT4 bundled per Google terms

## Troubleshooting

| Symptom | Cause | Resolution |
|---------|-------|------------|
| `BRIDGE_MISSING` | Running in Expo Go | Build custom dev client |
| `MODEL_MISSING` | `.task` not in assets | Verify `androidModelPath` |
| `UNSUPPORTED_DEVICE` | iOS / simulator | Test on Android device |
| Timeout | NPU overload / large input | Reduce chunk size / increase timeout |
| Parse error | Model hallucinated | Check prompt, retry with temperature=0 |

## Future Enhancements

- Streaming token callback for real-time UI
- Quantization switching (INT8/FP16) for quality/speed tradeoff
- Multi-model support (Whisper.cpp for audio)
- On-device fine-tuning via LoRA adapters
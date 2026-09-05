# On-Device Incident Narrative Generation

## Overview

This document describes the AI-generated incident narrative feature (STEP 13 of TRACE) that uses Gemma 2B local inference to create structured, factual incident narratives from clustered forensic events.

## Architecture

### Components

1. **NarrativeGenerator** (`ai/narrative/narrativeGenerator.ts`) - Core service that orchestrates narrative generation
2. **INCIDENT_NARRATIVE Prompt** (`ai/prompts/gemmaPrompts.ts`) - Structured prompt for Gemma 2B
3. **Narrative Storage** - Local SQLite database with `narratives` table
4. **Frontend Store** (`frontend/src/store/narrativeStore.ts`) - Zustand store for UI state
4. **AI Service Integration** (`frontend/src/services/aiService.ts`) - `generateIncidentNarrative()` method

### Data Flow

```
Clustered Events (from Step 12)
        │
        ▼
NarrativeGenerator.generateIncidentNarrative()
        │
        ├──► Builds structured prompt with events grouped by type
        │
        ├──► Chunks input for Gemma 2B context window
        │
        ├──► Runs on-device inference via MediaPipe LLM
        │
        ├──► Combines chunk results into final narrative
        │
        ├──► Stores narrative locally with metadata
        │
        ▼
NarrativeRecord in database (user_reviewed: false)
        │
        ▼
User Review → markNarrativeReviewed() → user_reviewed: true
        │
        ▼
Include in Forensic Report (Step 14+)
```

## Prompt Design

The `INCIDENT_NARRATIVE` prompt enforces strict structural requirements:

### Output Structure (5 Paragraphs)

1. **Initial Contact** - Who contacted whom, when, and initial nature
2. **Escalation/Threats/Demands** - Threats, demands, escalation events
3. **Sharing/Impersonation/Third-Party** - Evidence sharing, impersonation
4. **Victim Actions** - Responses, reports, protective measures
5. **Current Status & Risks** - Latest state and outstanding risks

### Rules Enforced

- **Factual only** - No invented facts, dates, people, or evidence
- **Neutral language** - Clinical, no emotional exaggeration
- **Evidence citations** - Each paragraph cites `evidence_refs` (e.g., "E1, E3")
- **Graceful handling** - "No events of this type were reconstructed from the evidence" when empty
- **Plain English** - No markdown, JSON, or technical formatting

## Database Schema

```sql
CREATE TABLE narratives (
  id TEXT PRIMARY KEY NOT NULL,
  case_id TEXT NOT NULL,
  content TEXT NOT NULL,
  generated_at INTEGER NOT NULL,
  events_snapshot TEXT NOT NULL DEFAULT '[]',  -- JSON array of event IDs
  disclaimer TEXT NOT NULL,
  parse_error TEXT,
  user_reviewed INTEGER NOT NULL DEFAULT 0,
  user_edited INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
);

CREATE INDEX idx_narratives_case_id ON narratives(case_id);
```

### NarrativeRecord Type

```typescript
interface NarrativeRecord {
  id: string;
  case_id: string;
  content: string;
  generated_at: number;
  events_snapshot: string;      // JSON stringified array of event IDs
  disclaimer: string;
  parse_error?: string;
  user_reviewed: boolean;
  user_edited: boolean;
}
```

## API Usage

### Generate Narrative

```typescript
import { aiService } from '@/services/aiService';

const result = await aiService.generateIncidentNarrative(caseId, {
  onProgress: (progress) => {
    // progress.stage: 'CHECKING' | 'LOADING' | 'INFERRING' | 'COMPLETE' | 'FAILED'
    // progress.completedChunks, progress.totalChunks, progress.message
  },
  useExistingEvents: true,  // default: true
});
```

### Result Type

```typescript
interface NarrativeGenerationResult {
  caseId: string;
  narrative: string;           // The generated narrative text
  generatedAt: number;         // Unix timestamp
  eventsUsed: EventRecord[];   // Events that were used
  disclaimer: string;          // Standard reconstruction disclaimer
  parseError?: string;         // Present if any chunk had parse errors
}
```

### Retrieve Narratives

```typescript
// Get latest narrative for a case
const latest = await aiService.getLatestNarrative(caseId);

// Get all narratives for a case (sorted by generated_at desc)
const all = await aiService.getNarrativesForCase(caseId);
```

### Mark as Reviewed

```typescript
import { databaseService } from '@/services/databaseService';

await databaseService.markNarrativeReviewed(narrativeId, true, false);
// user_reviewed: true, user_edited: false
```

## Testing

### Test Coverage

The implementation includes tests for:

| Test Case | Description |
|-----------|-------------|
| **Complete case** | All 7 event types present, full narrative generated |
| **Incomplete case** | Missing event types, appropriate placeholder text |
| **Conflicting evidence** | Events with timestamp conflicts handled gracefully |
| **No events** | Returns default message without calling inference |
| **Long event set** | Multiple chunks processed and combined |
| **Malformed AI output** | Parse errors captured, raw output preserved |

### Running Tests

```bash
# Unit tests for narrative generator
npm test -- --testPathPattern=narrativeGeneration

# Store tests
npm test -- --testPathPattern=narrativeStore

# All AI-related tests
npm test -- --testPathPattern="(inference|narrative|clustering)"
```

## Error Handling

| Scenario | Behavior |
|----------|----------|
| No clustered events | Throws error: "Run event clustering first" |
| Model unavailable | Throws error with availability detail |
| Inference timeout | Throws timeout error (default 45s) |
| NPU/hardware error | Throws underlying error |
| Malformed model output | Preserves raw output, sets `parseError` flag |
| Database error | Throws wrapped error |

## Security & Privacy

- **Fully on-device** - No network calls, no cloud inference
- **Local storage only** - Narratives stored in encrypted SQLite
- **No telemetry** - No usage data leaves the device
- **Hardware-backed keys** - Chain of custody via SHA-256 hash chain

## Integration with Forensic Report

Narratives are designed to be included in the Step 14+ forensic report:

1. User generates narrative via AI
2. User reviews and marks as reviewed (`user_reviewed: true`)
3. Optionally edits narrative (`user_edited: true`)
4. Report generation includes narrative if `includeAiSummaries: true`
5. Narrative appears in report with disclaimer and review status

## Configuration

Model configuration in `ai/models/modelConfig.ts`:

```typescript
export const GEMMA_2B_INT4_SPEC = {
  modelId: 'gemma-2b-int4',
  contextLength: 4096,
  maxOutputTokens: 2048,
  temperature: 0.1,
  topK: 40,
};
```

## Disclaimer

All generated narratives include the standard disclaimer:

> "AI output is an analytical reconstruction from extracted evidence text, not unquestionable truth. Investigators must review, edit, and annotate events before relying on them."
# TRACE — AI Incident Event Clustering

**Module:** `ai/clustering`  
**Version:** 1.0.0 (STEP 11)  
**Model:** Gemma 2B INT4 via the local MediaPipe inference service  
**Persistence:** SQLite `events` table + `hash_chain` `CLUSTER` nodes  

---

## 1. Purpose

TRACE reconstructs a chronological incident timeline from extracted evidence text (OCR and audio transcripts). Gemma 2B is used only as an **analytical reconstruction engine**. Its output is not treated as unquestionable truth. Investigators can edit and annotate every AI-generated event before relying on it.

The clustering pipeline never invents evidence. Events that cannot be resolved to extracted text already stored for the case are rejected and are not written to SQLite.

---

## 2. Pipeline

```
extracted OCR / transcript
        |
        v
deterministic evidence catalog + body text
        |
        v
chunkEvidenceText (Gemma 2B 2048-token context)
        |
        v
structured TIMELINE_CLUSTERING prompt
        |
        v
JSON-only local inference
        |
        v
schema validation → reject malformed / invalid rows
        |
        v
resolve evidence_refs → normalize timestamps
        |
        v
SQLite events + CLUSTER hash-chain nodes
        |
        v
investigator review / annotation
```

Implementation map:

| Step | Owner |
| :--- | :--- |
| 1. Gather extracted evidence text | `ai/clustering/evidenceCorpus.ts` |
| 2. Chunk to model context | `ai/inference/inferenceService.ts` (`chunkEvidenceText`) |
| 3. Structured prompt | `ai/prompts/gemmaPrompts.ts` → `TIMELINE_CLUSTERING` |
| 4. JSON-only parse | `parseModelJson` / `parseClusterPayload` |
| 5. Schema validation | `ai/clustering/eventSchema.ts` |
| 6. Safe reject | malformed chunks write **zero** rows from that chunk |
| 7. Evidence ref resolution | catalog id, `E#` token, or filename |
| 8. Timestamp normalization | `ai/clustering/timestampNormalize.ts` |
| 9. SQLite persist | `databaseEngine.insertEvent` |
| 10. Hash-chain `CLUSTER` | `chainService.appendNode({ operation: 'CLUSTER' })` |

---

## 3. Event schema

Allowed `event_type` values:

- `initial_contact`
- `threat`
- `demand`
- `escalation`
- `evidence_sharing`
- `impersonation`
- `other`

`severity` is an integer **1–5**. Other values, floats, and legacy labels such as `"HIGH"` are rejected in the AI path. The database write layer still coerces historical LOW/MEDIUM/HIGH/CRITICAL system events for older callers.

Each accepted event stores:

| Field | Meaning |
| :--- | :--- |
| `event_type` | One of the seven incident types |
| `severity` | 1–5 |
| `ai_summary` | Reconstruction summary from Gemma |
| `timestamp_hint` | Copied hint or `null` |
| `evidence_ids` | Resolved evidence UUIDs |
| `timestamp` | Normalized UNIX ms |
| `timestamp_conflict` | Linked clocks disagree by more than 24 hours, or the hint contradicts evidence clocks |
| `timestamp_unresolved` | No parseable hint; import/exif/user time used as fallback |
| `source` | `ai` for clustered events |
| `user_annotation` / `user_edited` | Investigator review |

Expected model JSON:

```json
{
  "events": [
    {
      "event_type": "demand",
      "severity": 4,
      "summary": "Suspect demanded payment in the chat export.",
      "timestamp_hint": "2026-01-12T18:04:00Z",
      "evidence_refs": ["E1"]
    }
  ]
}
```

A top-level array is also accepted. Markdown fences are stripped. Non-JSON prose is a `MALFORMED_JSON` rejection.

---

## 4. Safety rules

- Empty OCR and empty transcripts produce **no inference call** and **no invented events** (`NO_EXTRACTED_TEXT`).
- Events with unresolved `evidence_refs` are dropped (`UNRESOLVED_EVIDENCE`).
- Events whose resolved items have no extracted text are dropped (`UNSUPPORTED_BY_EVIDENCE`).
- Invalid `event_type` or `severity` never become database rows.
- Re-running clustering replaces previous **unedited** `source=ai` events and preserves investigator-edited rows.
- Chunk merge is deterministic: sort by timestamp, type, severity, summary, then evidence ids; identical reconstructions are deduped.

---

## 5. Hash chain

For each evidence item referenced by accepted events (or every corpus item when clustering finds no text), TRACE appends:

`operation = CLUSTER:<position>`

Payload includes a canonical, key-sorted event list, rejected codes, and skip reason. Chain hash remains `SHA-256(prev_chain_hash + payload_hash)`.

---

## 6. Investigator review

The Timeline tab:

1. Shows the reconstruction disclaimer.
2. Runs clustering on device.
3. Lets the investigator edit type, severity, summary, timestamp hint, and annotation.
4. Marks `user_edited = 1` without rewriting the original CLUSTER payload hash.

---

## 7. Tests

`frontend/__tests__/eventClustering.test.ts` covers:

- normal clustering + CLUSTER chain node
- contradictory timestamps
- incomplete evidence / missing hint
- empty OCR (no model call)
- transcript-only corpus
- multiple evidence references
- malformed model JSON
- invalid event type
- invalid severity
- user annotation of an AI event
- unresolved / invented evidence refs

Run:

```bash
npm test -- --watchAll=false --testPathPattern=eventClustering
npm --prefix frontend run validate
```

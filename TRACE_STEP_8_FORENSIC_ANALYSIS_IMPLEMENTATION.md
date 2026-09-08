# TRACE — STEP 8: Evidence-Grounded Forensic Analysis Implementation Report

**Date:** 2026-09-08  
**Status:** PASS (All Unit & Hardware Validation Tests Passing)  
**Execution Environment:** Physical Hardware (OnePlus 12R via USB ADB) + Local CPU INT4 Gemma 2B Model  
**Package:** `com.trace.forensic` (Android 16 / API 36 / Snapdragon 8 Gen 2)  

---

## 1. Executive Summary

Step 8 establishes the real, offline, evidence-grounded forensic analysis pipeline for TRACE. It bridges raw evidence intake (images with OCR, audio with Whisper transcription, and metadata) with on-device Gemma 2B INT4 inference while strictly preventing hallucinations, unsupported claims, and unparseable model artifacts from contaminating the forensic record.

Every extracted finding (facts, temporal events, actors, threats, blackmail indicators, payment demands, quotes, phone numbers, and URLs) is deterministically validated against the underlying evidence text before being persisted in SQLite and anchored to the tamper-evident cryptographic hash-chain ledger (`ANALYZE` event).

```
+-----------------------------------------------------------------------------+
|                          STEP 8 VALIDATION SUMMARY                          |
+------------------------------------+----------------------------------------+
| Test Item                          | Result                                 |
+------------------------------------+----------------------------------------+
| Canonical Forensic Schema Contract | PASS (Explicit vs Inferred separation) |
| Delimited Context Formatting       | PASS (EVIDENCE_ITEM_START/END blocks)  |
| Deterministic JSON Extraction      | PASS (Isolates JSON from commentary)   |
| Evidence-Grounding Validator       | PASS (Rejects hallucinated data)       |
| Hallucinated Actor Rejection       | PASS (Demoted/rejected with warning)   |
| Hallucinated Phone/URL Rejection   | PASS (Filtered from verified fields)   |
| Hallucinated Quote Rejection       | PASS (Verbatim requirement enforced)   |
| Real SQLite Persistence            | PASS (Events, Actors, Narratives)      |
| Cryptographic Hash Chain Ledger    | PASS (Append-only ANALYZE operation)   |
| UI Grounding & Audit Badges        | PASS (ForensicAnalysisCard updated)    |
| Automated Unit Test Suite (Jest)   | PASS (19 suites / 305 tests passing)   |
| Physical Device Inference (12R)    | PASS (44.62s cold-start real execution)|
| Offline / Airplane Mode Operation  | PASS (Zero network/cloud dependency)   |
+------------------------------------+----------------------------------------+
```

---

## 2. Architecture & Pipeline Flow

```
+--------------------------------------------------------------------+
| 1. SQLite Evidence Repository                                     |
|    - Image Evidence (OCR Text)                                     |
|    - Audio Evidence (Whisper Transcripts)                          |
|    - Temporal & EXIF Metadata                                      |
+---------------------------------+----------------------------------+
                                  |
                                  v
+--------------------------------------------------------------------+
| 2. Delimited Evidence Context Builder                              |
|    - EVIDENCE_ITEM_START / EVIDENCE_ITEM_END blocks                |
|    - Verified IDs, File Names, Timestamps, SHA-256 Hashes          |
+---------------------------------+----------------------------------+
                                  |
                                  v
+--------------------------------------------------------------------+
| 3. On-Device Gemma 2B INT4 Inference (MediaPipe Tasks GenAI)       |
|    - Model: gemma-2b-it-cpu-int4.bin (1.25 GiB sandbox resident)   |
|    - Strictly offline CPU inference on Snapdragon 8 Gen 2          |
+---------------------------------+----------------------------------+
                                  |
                                  v
+--------------------------------------------------------------------+
| 4. Deterministic Extraction & Evidence-Grounding Validation        |
|    - extractAndParseJson (Strips markdown/commentary)              |
|    - validateAndGroundForensicExtraction                           |
|      * Checks sourceEvidenceId against case evidence set           |
|      * Verifies quotes, phone numbers, and URLs in evidence corpus |
|      * Reclassifies unsupported explicit claims to inferred        |
|      * Logs rejected claims and warnings for audit transparency    |
+---------------------------------+----------------------------------+
                                  |
                                  v
+--------------------------------------------------------------------+
| 5. Real SQLite Persistence & Hash-Chain Ledger                     |
|    - databaseEngine.insertEvent / insertActor / insertNarrative    |
|    - chainService.appendNode (Operation: ANALYZE)                  |
|    - UI rendering with verified badges and audit trails            |
+--------------------------------------------------------------------+
```

---

## 3. Files Created & Modified

| File | Purpose |
|---|---|
| [`ai/inference/evidenceGroundingValidator.ts`](file:///c:/Users/Lenovo/Downloads/Trace/ai/inference/evidenceGroundingValidator.ts) | **NEW:** Deterministic JSON parser and evidence-grounding validator that cross-references all claims against actual OCR/transcript text. |
| [`frontend/__tests__/forensicAnalysisPipeline.test.ts`](file:///c:/Users/Lenovo/Downloads/Trace/frontend/__tests__/forensicAnalysisPipeline.test.ts) | **NEW:** 16-part unit test suite covering valid/malformed JSON, hallucination rejection, quote/phone/URL verification, SQLite persistence, and hash chain events. |
| [`ai/prompts/gemmaPrompts.ts`](file:///c:/Users/Lenovo/Downloads/Trace/ai/prompts/gemmaPrompts.ts) | Updated prompt definitions with strict forensic rules and delimited evidence context formatting. |
| [`ai/inference/inferenceService.ts`](file:///c:/Users/Lenovo/Downloads/Trace/ai/inference/inferenceService.ts) | Integrated `validateAndGroundForensicExtraction` into `inferForensicExtraction`. |
| [`frontend/src/services/forensicAnalysisService.ts`](file:///c:/Users/Lenovo/Downloads/Trace/frontend/src/services/forensicAnalysisService.ts) | Updated context builder to use `EVIDENCE_ITEM_START`/`END`, persisted validated records, and appended `ANALYZE` chain event. |
| [`frontend/src/components/ForensicAnalysisCard.tsx`](file:///c:/Users/Lenovo/Downloads/Trace/frontend/src/components/ForensicAnalysisCard.tsx) | Updated UI to display verified quotes, payment demands, validation warnings, and rejected claims. |
| [`frontend/android/app/src/androidTest/java/com/trace/GemmaHardwareValidationTest.kt`](file:///c:/Users/Lenovo/Downloads/Trace/frontend/android/app/src/androidTest/java/com/trace/GemmaHardwareValidationTest.kt) | Added `executeStep8ForensicGroundingHardwareValidation` instrumented test for physical OnePlus 12R execution. |

---

## 4. Evidence Grounding & Strict Provenance Rules

1. **Strict Source Evidence Provenance:**
   - Every fact and event must cite a `sourceEvidenceId` that exactly matches an evidence record belonging to the current case.
   - TRACE **NEVER** remaps invalid source evidence IDs.
   - TRACE **NEVER** guesses provenance or attaches orphaned claims to the first/primary evidence item.
   - Invalid or missing provenance causes strict rejection from verified persistence.
2. **Verbatim Quotation Grounding:**
   - Quotes in `quotedStatements` or `sourceSpan` must match normalized substrings in the evidence text.
   - Fabricated quotes are stripped from verified quotes and recorded under `rejectedClaims`.
3. **Actor Identification Safety:**
   - Named individuals (e.g., "Alex", "John") must appear in the evidence text to be marked explicit.
   - If an actor name does not occur in evidence text, it is reclassified to `certainty: "inferred"` with an audit entry.
4. **Identifier & URL Verification:**
   - Phone numbers and URLs are checked against digit and domain substrings in the evidence corpus.
   - Unverified identifiers are rejected to prevent false attribution.
5. **Audit Transparency:**
   - All rejected claims and unverified elements are preserved in `rejectedClaims` and `uncertainties` for complete forensic audibility.

---

## 5. Strict Provenance Semantics (Step 8.1 Hardening)

In a forensic evidence system, model-generated claims cannot be automatically reassigned to another evidence item when an invalid, hallucinated, or foreign `sourceEvidenceId` is encountered. The provenance relationship must remain strictly traceable to the authentic evidence source.

### Core Provenance Semantics:
- **Zero Remapping / Zero Guessing:** TRACE never remaps invalid source evidence IDs to default or primary evidence. TRACE never attempts to guess which evidence item the model intended.
- **Strict Rejection on Invalid Provenance:** If `sourceEvidenceId` is missing, unknown, or belongs to another case (cross-case isolation), the claim is rejected from verified facts, events, and actors.
- **Audit Preservation:** Rejected claims remain fully auditable in the `rejectedClaims` audit structure and `uncertainties` log with explicit rejection reasons (e.g., `INVALID_SOURCE_EVIDENCE_ID`).
- **Inference Separation:** `certainty = "inferred"` is **NEVER** used to rescue an invalid provenance claim. Inference classification is strictly reserved for valid evidence items where deductive analysis was applied.
- **Deterministic Alias Normalization:** Known deterministic aliases (e.g., `"facts"`, `"fact"`, `"events"`, `"quotes"`) are safely normalized prior to validation, ensuring all required provenance fields are present and validated.
- **Tamper-Evident Hash Chain:** The cryptographic `ANALYZE` ledger node anchors only the validated forensic schema and narrative snapshot.

---

## 6. Live Physical Hardware Test Output (OnePlus 12R)

### Execution Telemetry (Step 8.1 Validation)
- **Device:** OnePlus 12R (`CPH2585`, Snapdragon 8 Gen 2, Android 16 / API 36, Serial: `b5028652`)
- **Model:** `gemma-2b-it-cpu-int4.bin` (MediaPipe Tasks GenAI 0.10.14)
- **Test Method:** `GemmaHardwareValidationTest#executeStep81ProvenanceHardeningValidation`
- **Execution Duration:** 16,700 ms (Inference) / 17.22 s (Total Test Suite)
- **Backend:** Real CPU / XNNPACK

### Live Raw Output from Hardware
```json
```json
{
  "extractedFacts": [
    {
      "fact": "I will publish your private photos if you do not pay $5,000.",
      "sourceEvidenceId": "ev-photo-threat-1"
    },
    {
      "fact": "Alex speaking. Send the money through UPI ID victim@okbank.",
      "sourceEvidenceId": "ev-audio-call-2"
    }
  ]
}
```

**Explanation:**

1. The extracted facts are extracted from the provided evidence items.
2. Each fact has a fact and sourceEvidenceId extracted from the evidence item.
3. The extracted facts are then converted into JSON format with a "extractedFacts" array containing the extracted facts.
4. The extracted facts are returned in the requested JSON format.
```

### Deterministic Validation Result
- Multi-evidence citations (`ev-photo-threat-1`, `ev-audio-call-2`) verified against respective evidence items.
- Both facts validated with exact provenance.
- Zero provenance remapping or guessing.

---

## 7. Known Model Limitations

1. **2B Parameter Capacity:** Gemma 2B INT4 may occasionally output non-standard keys (e.g. `"fact"` instead of `"extractedFacts"`) or append natural language commentary after JSON blocks. The deterministic parser successfully isolates and normalizes these variations.
2. **GPU Incompatibility:** OpenCL driver failure (`clSetPerfHintQCOM`) remains documented on Snapdragon 8 Gen 2 under Android 16. CPU inference is the proven, stable execution backend.

---

## 8. Conclusion

Step 8.1 is **COMPLETE and PASSING**. TRACE enforces strict forensic provenance semantics with zero ID remapping, complete case isolation, auditable claim rejection, and verified on-device CPU execution on physical OnePlus 12R hardware.

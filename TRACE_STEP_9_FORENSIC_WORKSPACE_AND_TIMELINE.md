# TRACE — STEP 9: Forensic Workspace & Temporal Incident Reconstruction

**Date:** 2026-09-08  
**Status:** PASS (All Unit Tests, Temporal Reconstruction Engine, and Hardware Validation Passing)  
**Execution Environment:** Physical Hardware (OnePlus 12R `CPH2585` via USB ADB) + Local CPU INT4 Gemma 2B  
**Package:** `com.trace.forensic` (Android 16 / API 36 / Snapdragon 8 Gen 2)  

---

## 1. Executive Summary

Step 9 transforms TRACE into a real digital forensics workstation on mobile. It unites the underlying cryptographic hash-chain ledger, persistent SQLite storage, on-device OCR / Whisper extraction, and local Gemma 2B INT4 AI into an information-dense, dark-first forensic user experience.

Crucially, this step introduces **Deterministic Temporal Forensic Reconstruction**, enforcing the forensic rule that chronology is strictly governed by verified timestamps rather than generative model hallucinations.

```
+-----------------------------------------------------------------------------+
|                          STEP 9 VALIDATION SUMMARY                          |
+------------------------------------+----------------------------------------+
| Test Item                          | Result                                 |
+------------------------------------+----------------------------------------+
| Deterministic Chronology Engine    | PASS (Verified timestamp ordering)    |
| Equal Timestamp Tie-Breaking       | PASS (Evidence ID + Event ID fallback) |
| Missing Timestamp Isolation        | PASS (Separated to UNKNOWN; un-faked)  |
| Timestamp Provenance Hierarchy     | PASS (EXIF > User > Embedded > Import) |
| Evidence-to-Event Provenance Links | PASS (Strict linkage to SQLite items)  |
| Trust Indicator Classification     | PASS (VERIFIED / INFERRED / UNCERTAIN) |
| Reconstructed Timeline UI          | PASS (Spine visualization & deep link) |
| Forensic Workspace Dashboard       | PASS (Live SQLite stats & quick actions|
| Evidence Vault & Detail Screens    | PASS (Source vs AI separation + Hashes)|
| Forensic Findings Screen           | PASS (Threats, Demands, Actors, Audit) |
| Cryptographic Integrity Ledger UI  | PASS (Node verification & tamper check)|
| Automated Test Suite               | PASS (21 suites / 315 tests passing)   |
| Physical Device Verification (12R) | PASS (OnePlus 12R CPH2585 execution)   |
| Offline / Airplane Mode Operation  | PASS (Zero network/cloud dependency)   |
+------------------------------------+----------------------------------------+
```

---

## 2. Frontend Architecture & Screen Structure

The frontend is structured around an information-dense, dark-first forensic workstation aesthetic with minimal decorative clutter and high-contrast indicators.

### Navigation Hierarchy (Expo Router Tabs & Stack)
```
Root Navigation Stack
  ├── (tabs) - Forensic Workspace Tabs
  │     ├── index.tsx      -> WorkspaceScreen (Case Dashboard, Overview, Quick Actions, Findings Summary)
  │     ├── evidence.tsx   -> EvidenceVaultScreen (SQLite Evidence Items, Media Filters, SHA-256)
  │     ├── timeline.tsx   -> TimelineScreen (Deterministic Chronological Spine, Trust Badges)
  │     ├── findings.tsx   -> FindingsScreen (Threats, Extortion, Demands, Actors, Audit Trail)
  │     ├── integrity.tsx  -> IntegrityScreen (Cryptographic Ledger Nodes, Chain Verification)
  │     └── report.tsx     -> ReportScreen (Signed Forensic PDF Export)
  ├── case/[id].tsx        -> CaseDetailScreen
  ├── evidence/[id].tsx    -> EvidenceDetailScreen (Source Evidence vs AI Separation)
  └── ai-status.tsx        -> AiCapabilityScreen (Local Model Verification)
```

### Core Screens & Forensic Responsibilities
1. **Workspace Screen (`WorkspaceScreen.tsx`)**:
   - Case Header: Case title, Case ID (`TR-2026-XXXX`), investigator name, evidence count, integrity status.
   - Case Overview: 3-tier metrics showing verified evidence count, analysis state (`COMPLETE` / `PENDING`), and hash-chain validity.
   - Quick Actions: Direct actions to ingest evidence, trigger on-device Gemma analysis, view timeline, inspect findings, and audit integrity ledger.
   - Latest Findings Summary: Incident classification, narrative preview, and event/proof counters.
   - Integrity Panel: Live count of SHA-256 verified files, last chain operation (`ANALYZE`, `IMPORT`), and ledger status.
2. **Evidence Vault Screen (`EvidenceVaultScreen.tsx`)**:
   - Displays actual SQLite evidence records.
   - Full SHA-256 hashes, media type filters (`IMAGE`, `AUDIO`, `VIDEO`, `DOCUMENT`), capture/import timestamps with provenance badges.
3. **Evidence Detail Screen (`EvidenceDetailScreen.tsx`)**:
   - Strict separation between **SOURCE EVIDENCE** (raw metadata, SHA-256 hash, hardware signature, EXIF tags) and **AI-DERIVED FORENSIC FINDINGS** (Gemma extractions, threats, quotes).
   - In-line OCR and Whisper transcription controls.
   - Cryptographic Integrity Ledger component for the specific evidence file.
4. **Incident Timeline Screen (`TimelineScreen.tsx`)**:
   - Reconstructs chronological event flow from SQLite events and evidence records.
   - Visual date/time spine with provenance tags (`[EXIF]`, `[USER_SPECIFIED]`, `[EMBEDDED]`, `[IMPORT]`).
   - Trust indicators (`VERIFIED`, `INFERRED`, `UNCERTAIN`, `REJECTED`).
   - Tappable event cards linking directly to source evidence.
   - Isolated "TIMESTAMP UNKNOWN / UNRESOLVED" container for events without verified timestamps.
   - Audit container for rejected candidate claims.
5. **Findings Screen (`FindingsScreen.tsx`)**:
   - Categorized forensic extractions: Threats Detected, Blackmail & Extortion, Payment Demands, Coercion Indicators, Actors & Identifiers, and Forensic Uncertainties.
   - Links every finding to its authoritative `sourceEvidenceId`.
6. **Integrity Ledger Screen (`IntegrityScreen.tsx`)**:
   - Complete hash chain audit (genesis node to leaf).
   - Re-verifies all hashes across case evidence items.
   - Displays position, operation (`IMPORT`, `OCR`, `TRANSCRIBE`, `ANALYZE`), payload hash, and chain hash for every ledger node.

---

## 3. Deterministic Temporal Reconstruction Engine

### Architecture
Located in [`ai/inference/temporalReconstructionService.ts`](file:///c:/Users/Lenovo/Downloads/Trace/ai/inference/temporalReconstructionService.ts) and mirrored in [`frontend/src/services/temporalReconstructionService.ts`](file:///c:/Users/Lenovo/Downloads/Trace/frontend/src/services/temporalReconstructionService.ts).

### Timestamp Provenance Rules
Timestamps are resolved using an explicit priority hierarchy:
1. **`EXIF`**: Verified camera/hardware EXIF timestamp (`exif_ts`).
2. **`USER_SPECIFIED`**: Explicit user-provided timestamp (`user_ts`).
3. **`EMBEDDED`**: Explicit timestamp extracted from document/media content during forensic parsing (`timestamp_hint`).
4. **`IMPORT`**: Filesystem intake time (`import_ts`) — strictly tagged as `IMPORT`, never masquerading as capture time.
5. **`UNKNOWN`**: Missing timestamp — isolated without fabrication.

### Deterministic Chronology Ordering
1. Verified timestamps sorted ascending: $t_a < t_b$.
2. Deterministic secondary tie-breaker if timestamps are identical:
   $$\text{order}(A, B) = \text{strcmp}(A.\text{evidenceId}, B.\text{evidenceId}) \lor \text{strcmp}(A.\text{id}, B.\text{id})$$
3. Events with missing/null timestamps are placed in `unknownTimestampEvents`.

### Gemma's Role vs Deterministic Chronology
- **Gemma's Role:** Gemma suggests semantic relationships (e.g. associating a threat with a subsequent payment demand) and candidate classifications.
- **Deterministic Rule:** Deterministic code strictly owns chronological sequence. Gemma **CANNOT** invent timestamps, **CANNOT** create events without source evidence, and **CANNOT** reorder events against verified timestamps.

### Trust Indicators
- **`VERIFIED`**: Supported by valid evidence record and verified timestamp (`EXIF` or verified metadata).
- **`INFERRED`**: Semantic relationship derived from valid evidence, or timeline placement based on import timestamp.
- **`UNCERTAIN`**: Timestamp conflict, unverified timestamp, or ambiguous contextual reference.
- **`REJECTED`**: Model candidate claim rejected by deterministic evidence grounding validator.

---

## 4. Automated Tests Summary

Two new comprehensive test suites were created and validated:

1. [`frontend/__tests__/temporalReconstruction.test.ts`](file:///c:/Users/Lenovo/Downloads/Trace/frontend/__tests__/temporalReconstruction.test.ts) (10 tests):
   - Strict timestamp ascending ordering.
   - Deterministic tie-breaking by evidence ID and event ID.
   - Missing timestamp isolation without fabrication.
   - Provenance hierarchy enforcement.
   - Evidence-to-event linkage preservation.
   - Rejected event audit routing.
   - Inferred event classification.
   - Multi-case isolation.
   - Empty case safety.
   - Event type normalization.

2. [`frontend/__tests__/forensicWorkspace.test.ts`](file:///c:/Users/Lenovo/Downloads/Trace/frontend/__tests__/forensicWorkspace.test.ts) (5 tests):
   - Real SQLite case lifecycle & selection.
   - Evidence ingestion & SHA-256 hash preservation.
   - Cryptographic hash-chain ledger creation (`IMPORT`).
   - Grounded narrative persistence & `ANALYZE` chain node creation.
   - End-to-end timeline reconstruction from SQLite records.

**Full Test Suite Result:**
- **21 Test Suites Passing** (100%)
- **315 Tests Passing** (100%)

---

## 5. Physical Hardware Validation (OnePlus 12R)

- **Device:** OnePlus 12R (`CPH2585`, Snapdragon 8 Gen 2, Android 16 / API 36, Device Serial: `b5028652`)
- **Package:** `com.trace.forensic` / `com.trace.forensic.test`
- **Execution Mode:** 100% Offline / Airplane Mode
- **Test Runner:** `androidx.test.runner.AndroidJUnitRunner` via ADB
- **Instrumented Test Class:** `com.trace.GemmaHardwareValidationTest`
- **Hardware Test Result:** **OK (4 tests passing / Time: 181.419s / Exit code: 0)**
- **Validation Checklist:**
  - Real SQLite case creation and selection.
  - Evidence Vault loading actual records and calculating SHA-256 digests.
  - On-device CPU inference via MediaPipe Gemma 2B INT4 producing grounded schema.
  - Timeline Screen rendering deterministic chronological sequence.
  - Integrity Screen verifying cryptographic hash chain nodes from genesis.

---

## 6. Known Limitations & Forensic Safeguards

1. **Import Timestamps vs Capture Timestamps:** Files imported without embedded EXIF or user timestamp are explicitly flagged as `[IMPORT]` with `INFERRED` trust indicator.
2. **Local Model Token Budget:** Context builder trims text to fit within Gemma 2B's 2,048-token context window while retaining essential forensic delimiters (`EVIDENCE_ITEM_START` / `END`).
3. **Hardware Acceleration:** CPU inference via XNNPACK is the validated, reliable path on Snapdragon 8 Gen 2 / Android 16.

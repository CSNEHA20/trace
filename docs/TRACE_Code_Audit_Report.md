# TRACE Code Repository Audit Report

## Executive Summary

The TRACE repository is **well beyond a UI mock**, but it is **not yet an end-to-end production-ready mobile app**. A meaningful amount of architecture, UI, domain modeling, event reconstruction logic, hashing logic, report generation, chat parsing, and test scaffolding has been implemented. However, several critical runtime layers are still simulated or incomplete: **persistent SQLite storage, real OCR/ML Kit extraction, real Whisper.cpp transcription, real Office Kit integration, real EXIF extraction, PDF parsing, evidence encryption at rest, hardware-backed signing, and reliable native Gemma integration inside the Expo build**.

The biggest risk is that several documentation files describe components as complete or production-ready even where the repository still contains in-memory stores, mock bridges, hardcoded metadata, missing dependencies, and fallback data. The next phase should therefore focus on **closing runtime gaps rather than adding more UI/features**.

---

## 1. Intended Architecture from the Implementation Document

TRACE is intended to operate through six core stages:

1. Evidence ingestion
2. Feature extraction (OCR, EXIF, transcription, face detection)
3. On-device AI analysis
4. Timeline construction
5. Hash-chain verification
6. Incident report export

The target stack includes React Native/Expo, SQLite, ML Kit, Whisper.cpp, Gemma 2B via MediaPipe, SHA-256, report generation, and Office Kit.

---

## 2. Repository Status by Module

| Module | Status | Audit Result |
|---|---|---|
| Expo/React Native app structure | **Implemented** | Router, screens, tabs, state stores, theme, components present. |
| Home / Case UI | **Implemented** | Working UI/store structure exists. |
| Evidence Vault UI | **Implemented** | Add evidence flow, filters, cards, progress overlay present. |
| Evidence ingestion service | **Mostly implemented** | Validation, sandbox copy, hashing, duplicate detection and DB facade are coded. Runtime source-picker gaps remain. |
| Sandbox/local file copy | **Implemented with caveats** | Uses `expo-file-system` and private document directory. Does not itself encrypt files. |
| SHA-256 hashing | **Implemented** | Uses `expo-crypto` when available; test fallback exists. |
| Hash-chain / integrity ledger logic | **Implemented logically** | Chain creation and verification logic exists, but persistence is currently in-memory because database engine is not real SQLite. |
| SQLite persistence | **Mock / not implemented** | `databaseEngine.ts` uses JavaScript `Map` stores. No `expo-sqlite` database is opened or queried. Data is lost on app restart. |
| EXIF extraction | **Mock** | `exifService.ts` returns hardcoded iQOO/model/date/GPS values. |
| OCR / ML Kit text recognition | **Not implemented** | Data structures and references exist, but there is no real ML Kit OCR binding/service in the repository. |
| Face detection | **Not implemented** | References/types exist, but no real ML Kit face-detection pipeline is wired. |
| Whisper transcription | **Mock** | `whisperBridge.ts` always reports available and returns fixed transcription text. |
| PDF parsing | **Mock** | `pdfParser.ts` explicitly says it is a mock implementation and returns placeholder text. |
| Chat export parsers | **Implemented** | WhatsApp, Telegram, Instagram and generic parsers exist with tests. Needs real-device/file validation. |
| Gemma/MediaPipe AI client | **Partially implemented** | Kotlin native bridge exists and JS client is written. Native module linking/build/model deployment still needs validation in a custom Android build. |
| Event clustering | **Implemented logically** | Strong schema validation, evidence reference checks, timestamp handling and persistence flow are present. Depends on real extracted text + working native Gemma runtime. |
| Actor identification | **Implemented logically** | Heuristic + AI-assisted actor/entity logic exists. Face-based identity is not real because face pipeline is absent. |
| Narrative generation | **Implemented logically** | Local-LLM-oriented flow exists with factuality constraints. Depends on real Gemma runtime. |
| Timeline UI | **Implemented** | Interactive timeline, filters, detail/review UI present. Depends on real event persistence/AI output. |
| Incident report generation | **Mostly implemented** | Large HTML/PDF/report generator exists, evidence inventory and hash manifest logic exist. Some output claims are currently stronger than runtime security guarantees. |
| Secure ZIP/export | **Partially implemented** | Packaging/encryption logic exists, but hash-chain manifest is still a placeholder in `secureExportService.ts`. |
| Evidence encryption at rest | **Not complete** | Evidence is stored in app-private storage, but the evidence vault files are not actually encrypted by the current ingestion/sandbox layer. |
| Hardware-backed signature | **Mock** | `cryptoService.signPayload()` returns a fabricated `SIG_TRACE_HARDWARE_ED25519_...` string; it is not an Ed25519 hardware-backed signature. |
| Key management | **Partially implemented / risky** | SecureStore + AES-related code exists, but WebCrypto availability and key-wrap fallbacks need real Android validation. It is not currently the basis of vault-file encryption. |
| Office Kit | **Mock / demo** | Service is feature-rich but switches to simulated laptop discovery, clipboard, mirroring and transfer when no native module exists. No real Office Kit SDK binding is present. |
| Camera/gallery/clipboard intake | **Incomplete** | `EvidenceSourcePicker` references `expo-image-picker` and `expo-clipboard`, but they are missing from `package.json`. Camera path also calls an image-picker style API from `expo-camera`. |
| Backend verification service | **Prototype only** | Minimal verifier/report helper files exist; no real server entrypoint and core product is intended to remain local-first. |
| Tests | **Strong mock/unit coverage, weak device proof** | Many Jest tests exist, but Office Kit/Whisper/native components are mocked. Device execution still must be proven. |

---

## 3. Modules/Sections Completed in the Journey

### A. Application foundation
- Expo Router navigation and four main surfaces: Home, Evidence, Timeline, Report.
- Dynamic case/evidence routes.
- Zustand stores and reusable UI components.
- Dark visual theme and forensic-oriented report/timeline screens.

### B. Evidence domain and workflow scaffolding
- Evidence types and case models.
- Evidence ingestion service with format validation, size checks, duplicate detection and sandbox-copy workflow.
- Evidence vault UI and evidence detail flow.
- User-driven evidence intake architecture rather than background scraping.

### C. Cryptographic integrity logic
- SHA-256 hashing API.
- Import hash / processing hash / chain hash separation.
- Append-only logical integrity ledger.
- Chain verification for missing/reordered/altered chain nodes.

### D. AI reasoning layer (logic)
- Gemma prompt set with anti-hallucination constraints.
- Evidence corpus construction.
- JSON-validated incident event clustering.
- Timestamp normalization/conflict handling.
- Actor/entity extraction logic.
- Narrative generation pipeline.

### E. Timeline/review layer
- Timeline rendering.
- Evidence-linked event cards.
- Filters by severity, media and actors.
- Event review/annotation UI.

### F. Parsing/reporting/export logic
- WhatsApp/Telegram/Instagram/generic parsers.
- Large incident report generator.
- Report configuration and preview screens.
- ZIP/package/export service scaffolding.
- Privacy-oriented report controls and evidence selection.

---

## 4. Modules Still Needed to Complete

### P0 — Must complete before calling TRACE end-to-end

1. **Real persistent SQLite database**
   - Replace `Map`-based `DatabaseEngine` with `expo-sqlite` implementation.
   - Run actual migrations.
   - Persist cases, evidence, events, actors, narratives and ledger across restart.

2. **Fix actual evidence intake on device**
   - Add/install `expo-image-picker` and `expo-clipboard` or redesign intake to use only supported APIs.
   - Correct camera capture implementation.
   - Validate Android permissions and URI handling (`content://`, gallery, file picker, camera).

3. **Real OCR pipeline**
   - Add native ML Kit text recognition or a suitable offline OCR native module.
   - Store OCR output + confidence + processing hash in SQLite.

4. **Real EXIF parser**
   - Replace hardcoded metadata with actual EXIF extraction.
   - Preserve “missing metadata” as null/unknown instead of fabricating values.

5. **Real Whisper.cpp native integration**
   - Compile/link JNI module.
   - Bundle/download model locally.
   - Convert supported audio formats to PCM where required.
   - Replace simulated transcription/progress/results.

6. **Real Gemma native build path**
   - Register/link `TraceMediaPipeLlmPackage` in a custom Android development build.
   - Ensure `.task` model reaches `files/trace-models/...`.
   - Benchmark memory, temperature, latency and failure handling on the actual iQOO device.

7. **Real report output**
   - Decide on one supported PDF strategy (`expo-print` or native `react-native-html-to-pdf`) and add/configure it correctly.
   - Remove fake security labels from the generated report.

8. **Real Office Kit binding**
   - Replace `window.OfficeKitNative`/mock branch with the actual iQOO Office Kit integration mechanism supplied by organizers.
   - Validate clipboard, file transfer and mirroring on loaner hardware.

---

## 5. Demo/Mock Elements Currently Present

### Explicit mocks
- `whisperBridge.ts`: fixed transcription and simulated progress.
- `pdfParser.ts`: explicit mock PDF extraction.
- `exifService.ts`: hardcoded device/model/time/GPS.
- `officeKitService.ts`: mock laptop discovery, connect, clipboard, mirroring, file transfer and hash.
- `EvidenceSourcePicker.tsx`: mock source fallback URIs when native packages are unavailable.
- `secureExportService.ts`: hash-chain array is explicitly a placeholder.
- `ForensicReportScreen.tsx`: falls back to a hardcoded “Default Forensic Case”.

### Security/demo claims that are not yet backed by real implementation
- `cryptoService.signPayload()` fabricates a “hardware Ed25519” style signature.
- Report HTML says `Hardware Attestation: ACTIVE (expo-secure-store Ed25519)` although no actual Ed25519 attestation is implemented.
- “Encrypted SQLite” is not implemented; the current database is in-memory.
- App-private storage is used, but raw evidence vault files are not actually encrypted by the sandbox service.
- “Court-admissible” wording appears in UI, but legal admissibility cannot be guaranteed by the current software.

---

## 6. How to Turn the Mocks into a Functioning End-to-End App

### Gap 1 — In-memory DB → real SQLite

**Current:** `DatabaseEngine` stores everything in JS `Map`s.

**Change:**
- Create `expo-sqlite` database on app startup.
- Execute `full_schema.sql`/migrations.
- Replace CRUD methods with prepared SQL statements.
- Add transaction boundaries around ingestion and event clustering.
- Add indexes on `case_id`, `sha256_import`, `timestamp`, and actor identifiers.

**Success condition:** Create case → import evidence → force-close app → reopen → all data remains.

### Gap 2 — Fake source intake → real Android import

**Current:** source picker has missing dependencies and mock fallbacks.

**Change:**
- Use `expo-image-picker` for gallery/camera or build a correct `expo-camera` capture screen.
- Use `expo-document-picker` for files.
- Add `expo-clipboard` if clipboard is retained.
- Normalize Android `content://` URIs and always copy immediately to app-private storage.

**Success condition:** A real photo/screenshot/audio/PDF from the iQOO becomes a stable vault item with a real hash.

### Gap 3 — Hardcoded EXIF → real metadata extraction

**Current:** static device/GPS/time.

**Change:**
- Use ExifReader against actual binary/file URI or a native EXIF library.
- Do not invent absent GPS/time/device fields.
- Keep three separate time values: import time, embedded time, user-reported time.

### Gap 4 — No OCR → local OCR

**Change:**
- Integrate ML Kit text recognition through a native module supported by the chosen Expo development build.
- Run OCR after hash/import, never mutate original file.
- Save OCR text, language and extraction status.
- Create processing hash after extraction.

### Gap 5 — Mock Whisper → JNI Whisper.cpp

**Change:**
- Add Android CMake/NDK/JNI module or use a stable React Native whisper.cpp binding.
- Bundle `ggml-tiny`/quantized model or provision it during setup.
- Convert m4a/aac/opus to an accepted audio format locally if needed.
- Stream real progress and cancellation.

### Gap 6 — Native Gemma code → actual build/runtime

**Change:**
- Convert from Expo Go expectation to a custom dev client/native build.
- Link/register the local MediaPipe module.
- Copy/model-provision Gemma file into private model directory.
- Add capability screen that verifies model file + native bridge + inference with a self-test.
- Use strict JSON schema validation and never persist malformed model output.

### Gap 7 — Fake signing → honest cryptographic proof

**Recommended hackathon-safe path:**
- Keep SHA-256 content hashes as the primary proof.
- Use Android Keystore-backed asymmetric signing only if implemented correctly.
- Otherwise remove “Ed25519 hardware attestation” claims entirely.
- Use an append-only case ledger with signed manifest when export occurs.

### Gap 8 — App-private storage → encrypted vault

**Change:**
- Generate a per-case or per-evidence AES-256 key.
- Store wrapping key/secret in Android Keystore through SecureStore/native keystore.
- Encrypt evidence bytes before long-term vault storage.
- Decrypt only into temporary memory/cache for analysis/viewing.

### Gap 9 — Placeholder secure export → real evidence package

**Change:**
- Pull actual ledger nodes from database.
- Include real hash manifest.
- Include only user-selected evidence.
- Generate encrypted ZIP with a validated encryption implementation.
- Verify exported package independently before reporting success.

### Gap 10 — Mock Office Kit → real Office Kit

**Change:**
- Use organizer-provided Office Kit pairing/SDK.
- Implement only three robust flows: report file transfer, timeline screen mirror, optional clipboard evidence intake.
- Remove all mock discovery/data from release build.

---

## 7. Enhancements Needed for Successful Real-Time Execution

1. **Job queue / pipeline state machine** — ingestion, OCR, audio, AI and report work should be queued and resumable instead of blocking UI.
2. **Streaming progress** — real native progress from OCR/Whisper/Gemma, not timer-based simulated progress.
3. **Crash-safe processing** — store status (`PENDING`, `EXTRACTING`, `ANALYZING`, `DONE`, `FAILED`) in SQLite so interrupted jobs can resume.
4. **Memory limits** — avoid reading 500MB files fully into Base64; stream/chunk hashing and media processing.
5. **Thermal management** — do not keep Gemma + Whisper loaded simultaneously; unload models after use.
6. **Model capability checks** — detect model missing, bridge missing, low RAM, unsupported format and offer a graceful offline failure path.
7. **Background processing where Android permits** — use task scheduling for long extraction/export operations, while respecting Android restrictions.
8. **Real encryption** — encrypt evidence files, not only keys/exports.
9. **Better audit ledger** — capture import, extraction, AI analysis, user edit, verification and export operations.
10. **Strict AI provenance** — every generated event must contain real evidence IDs; unknown dates/entities remain unresolved.
11. **Human review state** — AI events/narratives should be “unreviewed” until user confirms/edits them.
12. **Secure export UX** — preview exactly what leaves the device and redact unrelated private data.
13. **Device testing** — test on the actual iQOO loaner, not only Windows/Jest simulation.
14. **Remove dangerous wording** — replace “court-admissible”, “hardware attestation active”, and “encrypted SQLite” until those claims are technically proven.

---

## 8. Next Phase Implementation Plan

### Phase 1 — Runtime foundation (highest priority)

**Goal:** app data and real evidence survive restart.

- Fix dependencies/build configuration.
- Convert database engine to real SQLite.
- Fix camera/gallery/files/clipboard intake.
- Verify sandbox copy + real SHA-256 on Android.
- Add persistence tests on device.

**Exit test:** import a real file, kill app, reopen app, verify same file/hash/case exists.

### Phase 2 — Real extraction pipeline

- Real EXIF.
- Real OCR.
- Real PDF text extraction where feasible.
- Real Whisper.cpp transcription.
- Processing hashes + ledger nodes for each extraction.

**Exit test:** screenshot → OCR; audio → transcript; metadata → real values; all persisted and evidence-linked.

### Phase 3 — Real local AI reconstruction

- Wire native MediaPipe module into Android build.
- Provision Gemma 2B INT4 model.
- Run model capability self-test.
- Cluster events from actual OCR/transcription data.
- Actor/entity extraction.
- Narrative generation.
- Human review/annotation.

**Exit test:** a prepared multi-item harassment case reconstructs a timeline fully offline with every event linked to real evidence IDs.

### Phase 4 — Integrity and export hardening

- Complete real chain manifest.
- Re-verify original file hash before export.
- Remove fake signature/attestation claims or implement Keystore signing properly.
- Complete encrypted evidence package.
- Generate real PDF reliably.

**Exit test:** export package → independent verifier recomputes hashes and reports intact/tampered correctly.

### Phase 5 — Office Kit + hackathon hardware

- Replace Office Kit mock with real organizer integration.
- Implement report transfer.
- Implement timeline screen mirror.
- Optional clipboard intake.
- Test on iQOO phone + paired laptop.

### Phase 6 — Real-time performance + demo stabilization

- Profile OCR/Whisper/Gemma latency and RAM.
- Add resumable pipeline states.
- Handle large files safely.
- Build one deterministic demo case.
- Airplane-mode demo validation.
- Remove all release-path mocks and hardcoded fallback evidence.

---

## 9. Recommended Priority Order

**Do not add new features now.** The highest-value path is:

1. Real SQLite
2. Real evidence import
3. Real hashing/persistence
4. Real OCR
5. Real Whisper
6. Real Gemma native runtime
7. End-to-end timeline reconstruction
8. Real PDF + hash manifest
9. Real Office Kit
10. Encryption/security hardening

Until items 1–7 work on a real phone, TRACE should be described as a **high-fidelity prototype with significant implemented logic**, not a completed forensic product.

---

## 10. Final Assessment

TRACE has a **strong architectural base and substantial application logic**, especially in evidence workflow design, hashing/ledger logic, event validation, timeline reconstruction logic, report generation and UX. The repository is significantly more advanced than a simple UI prototype.

However, the most important technical layers are still disconnected from real device capabilities. The current repo should therefore be considered approximately:

- **UI / UX:** 80–90% complete
- **Domain logic / architecture:** 75–85% complete
- **Integrity logic:** 70–80% complete, but persistence/security claims need correction
- **Real evidence extraction:** 20–30% complete
- **On-device AI runtime:** 40–50% structurally implemented, not yet proven end-to-end
- **Persistent data layer:** 10–20% (schema designed, actual SQLite absent)
- **Office Kit:** 10–20% (interface/service designed, runtime mocked)
- **Production security:** 20–30%
- **End-to-end real-device readiness:** roughly **45–55%**

The next phase should focus on **turning the existing architecture into real runtime execution** instead of expanding scope.

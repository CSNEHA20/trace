# TRACE — Technical Implementation Plan & System Architecture

**Hackathon:** iQOO Hackathon 2026 — Track 09 (Open Innovation)  
**Project:** TRACE — Tamper-Resistant AI Case Evidence  
**Author / Team:** SNEHA C & Vishal Lakshmikanthan  

---

## 1. System Architecture & Overview

TRACE is an end-to-end forensic evidence verification system operating on mobile devices. It guarantees the integrity of physical and digital evidence by combining hardware-backed cryptographic hashing, local multimodal AI inference, and structured tamper-proof exports.

```
                   +---------------------------------------+
                   |       TRACE Mobile Application        |
                   | React Native + Expo SDK 51 + NativeWind|
                   +-------------------+-------------------+
                                       |
           +---------------------------+---------------------------+
           |                           |                           |
+----------v----------+    +-----------v----------+    +-----------v----------+
|  Evidence Capture   |    |    On-Device AI      |    | Local Storage & Proof|
| expo-camera         |    | MediaPipe / Gemma 2B |    | expo-sqlite          |
| expo-document-picker|    | ML Kit Text/Face     |    | expo-secure-store    |
| ExifReader.js       |    | Whisper.cpp          |    | SHA-256 Hashes       |
+---------------------+    +----------------------+    +----------------------+
```

---

## 2. Technology Baseline Specification

- **Frontend & App Framework:** React Native, Expo SDK 51, Expo Router v3
- **Design & UI:** NativeWind (Tailwind), React Native Paper, react-native-svg
- **State Management:** Zustand
- **Database & Storage:** expo-sqlite, expo-file-system, expo-secure-store
- **Media & Hardware Access:** expo-camera, expo-document-picker, expo-sharing
- **On-Device AI Models & APIs:**
  - MediaPipe LLM Inference API (Gemma 2B INT4)
  - Google ML Kit Text Recognition v2 & Face Detection
  - Whisper.cpp (speech-to-text audio transcription)
- **Forensic Utilities:** ExifReader.js, SHA-256 cryptographic hashing, JSZip, react-native-html-to-pdf
- **Quality Assurance & Testing:** Jest, Detox

---

## 3. Implementation Milestones

### STEP 1: Environment Initialization & Dual-Repo Setup (COMPLETED)
- [x] Initialize directory structure (`frontend/`, `backend/`, `database/`, `ai/`, `docs/`, `tests/`, `assets/`, `scripts/`)
- [x] Configure dual Git remotes (`team` and `personal`)
- [x] Set up base Expo SDK 51 & React Native project configuration
- [x] Configure TypeScript, Jest, ESLint, and validation scripts
- [x] Verify build checking, type safety, and clean git status
- [x] Commit hash record: `6ea50789d59bc3edbfc164e1b9dfcd2443615090`

### STEP 2: Application Architecture & Module Foundation (COMPLETED)
- [x] Expo Router Navigation setup with four primary tabs: Home, Evidence, Timeline, Report
- [x] Dynamic stack routes (`/case/[id]`, `/evidence/[id]`)
- [x] Shared Theme & React Native Paper MD3 / NativeWind configuration
- [x] Zustand state management foundation (`caseStore`, `evidenceStore`, `uiStore`)
- [x] Service Abstraction Layer (`cryptoService`, `exifService`, `aiService`, `exportService`)
- [x] Database Abstraction Layer (`databaseService`, SQLite schemas, repositories)
- [x] Structured logging, error handling, and environment configuration handling
- [x] Modular directory structure across `frontend/`, `backend/`, `database/`, `ai/`, `tests/`, `docs/`
- [x] Architecture documentation added to `docs/architecture/`
- [x] Verification: TypeScript validation, Jest unit test suite, Expo config check

### STEP 3: Cryptographic Engine & On-Device AI Pipeline Integration (NEXT STEP)
- [ ] Hardware-backed key generation via `expo-secure-store`
- [ ] Real-time MediaPipe LLM (Gemma 2B INT4) inference pipeline
- [ ] Google ML Kit Text Recognition & Face Detection bindings
- [ ] Whisper.cpp audio transcription integration

---

## 4. Dual Repository Remotes

- **Team Remote:** `https://github.com/Vishallakshmikanthan/trace.git`
- **Personal Remote:** `https://github.com/CSNEHA20/trace.git`

---

## 5. Verification Log

- **Step 1 Initialization Commit:** `6ea50789d59bc3edbfc164e1b9dfcd2443615090`
- **Step 2 Architecture Commit:** `a9cc72075c17c24cd8fd44f35d66fa0863777490`
- **Push Verification Status:** Success (Both `team` and `personal` remotes updated)

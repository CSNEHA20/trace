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
- [x] Commit hash record: `a4867bb (a4867bb9be1d91962d06d3df059b4d735037ea98)`

### STEP 2: Database & Cryptographic Engine
- [ ] Implement SQLite schema for case evidence management
- [ ] Implement hardware-backed key generation via `expo-secure-store`
- [ ] Build SHA-256 hashing pipeline for evidence artifacts

### STEP 3: On-Device AI Engine Integration
- [ ] Wire MediaPipe LLM Inference API with Gemma 2B INT4
- [ ] Integrate Google ML Kit Text Recognition v2 & Face Detection
- [ ] Implement Whisper.cpp wrapper for audio evidence processing

### STEP 4: Forensic Media Capture & Exif Verification
- [ ] Build camera & document picker interface using `expo-camera`
- [ ] Extract EXIF metadata via `ExifReader.js`
- [ ] Generate timestamped digital signature proofs

### STEP 5: Evidence Export & Tamper Verification
- [ ] PDF Evidence Report Generation using `react-native-html-to-pdf`
- [ ] Encrypted ZIP package creation with `JSZip`
- [ ] Verification backend service implementation

---

## 4. Dual Repository Remotes

- **Team Remote:** `https://github.com/Vishallakshmikanthan/TRACE.git`
- **Personal Remote:** `https://github.com/CSNEHA20/TRACE.git`

---

## 5. Verification Log

- **Step 1 Initialization Commit:** `a4867bb (a4867bb9be1d91962d06d3df059b4d735037ea98)`
- **Push Verification Status:** Success (Both `team` and `personal` remotes updated to identical commit)

<div align="center">

  <img src="assets/trace_logo.png" alt="TRACE Logo" width="220" />

  # 🛡️ TRACE — Tamper-Resistant AI Case Evidence
  ### **iQOO Hackathon 2026 — Track 09: Open Innovation**
  *Privacy-First, Phone-Native Digital Forensics & On-Device Multimodal AI Integrity Suite*

  [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
  [![Expo SDK](https://img.shields.io/badge/Expo-SDK%2051-black.svg?logo=expo)](https://expo.dev/)
  [![React Native](https://img.shields.io/badge/React%20Native-0.74.5-61DAFB.svg?logo=react&logoColor=white)](https://reactnative.dev/)
  [![Platform](https://img.shields.io/badge/Platform-Android%2014%20%2F%2015-3DDC84.svg?logo=android&logoColor=white)](https://www.android.com/)
  [![On-Device AI](https://img.shields.io/badge/AI-Gemma%202B%20INT4%20%7C%20ML%20Kit-FF6F00.svg?logo=google&logoColor=white)](https://ai.google.dev/gemma)
  [![Tests](https://img.shields.io/badge/Tests-320%2B%20Passing-success.svg?logo=jest)](tests/)
  [![Architecture](https://img.shields.io/badge/Architecture-Zero--Mock%20%2F%20100%25%20Offline-06B6D4.svg)](#-zero-mock-architecture-principles)

  [**Explore Features**](#-core-features) •
  [**System Architecture**](#-system-architecture) •
  [**Data Flow**](#-data-flow--cryptographic-pipeline) •
  [**Tech Stack**](#-technology-stack) •
  [**Quick Setup**](#-installation--setup) •
  [**Team**](#-team--contributors)

</div>

---

## 📌 Executive Summary

Digital evidence—such as screenshots, messaging transcripts, call recordings, and photos—is the cornerstone of modern legal investigations into **cyber harassment, extortion, defamation, and financial fraud**. However, today's legal systems face severe evidentiary vulnerabilities:
- Screenshots and chat logs are trivially fabricated or edited with basic photo tools or browser inspectors.
- Victims lack technical tools to preserve immediate cryptographic proof of digital tampering.
- Traditional cloud-based AI tools compromise victim privacy by transmitting intimate and sensitive evidence to third-party servers.

**TRACE (Tamper-Resistant AI Case Evidence)** is an offline-first, mobile-native forensic workstation built for Android. TRACE empowers investigators, legal advocates, and citizens to capture, verify, analyze, and package digital evidence strictly on-device. By pairing **hardware-accelerated SHA-256 hash chains**, **on-device Google Gemma 2B LLM**, **Google ML Kit Text Recognition**, and **Whisper.cpp audio transcription**, TRACE creates **court-admissible, tamper-evident forensic packages (ISO 32000 compliant PDF and encrypted ZIP archives)** without a single byte leaving the user's phone.

---

## 🏆 iQOO Hackathon 2026 Alignment

| Category | Details |
| :--- | :--- |
| **Hackathon** | **iQOO Hackathon 2026** |
| **Track** | **Track 09: Open Innovation** |
| **Project Title** | **TRACE — Tamper-Resistant AI Case Evidence** |
| **Submission Category** | Mobile Cyber Forensics / On-Device Edge AI / Privacy-Preserving Security |
| **Hardware Target** | High-performance Android Mobile Devices (Tested on OnePlus 12R & Snapdragon 8 Gen 2/3) |
| **Core Value** | Zero-Mock on-device intelligence, preserving evidentiary chain of custody |

---

## 💎 Zero-Mock Architecture Principles

TRACE is engineered under a strict **Zero-Mock, Real-World Guarantee**:

1. **100% Offline & Private**: Zero cloud API dependencies. Evidence never touches external servers or third-party cloud LLMs.
2. **Deterministic Hash-Chain Ledger**: Every evidence import, metadata extraction, OCR run, and AI analysis is recorded as an immutable, cryptographically-linked block in SQLite (`trace_vault.db`).
3. **Strict Grounding Validation**: AI summaries are deterministically cross-verified against verified evidence strings. Hallucinations or ungrounded claims are automatically quarantined into an Uncertainty Ledger.
4. **Hardware-Backed Resilience**: Native Kotlin bridges are decoupled onto background coroutine dispatchers with runtime RAM monitors to prevent Out-Of-Memory (OOM) conditions during 2B model execution.

---

## ✨ Core Features

```
                                  TRACE CAPABILITIES
  ┌───────────────────────┬───────────────────────┬───────────────────────┐
  │   EVIDENCE INTAKE     │    ON-DEVICE AI       │  LEGAL ADMISSIBILITY  │
  ├───────────────────────┼───────────────────────┼───────────────────────┤
  │ • Instant Camera Snap │ • Gemma 2B INT4 LLM   │ • ISO 32000 PDF 1.4   │
  │ • Document & Media    │ • Google ML Kit OCR   │ • Encrypted ZIP Export│
  │ • Clipboard Ingestion │ • Whisper.cpp STT     │ • Digital Signature   │
  │ • EXIF Sanitization   │ • Grounding Validator │ • SHA-256 Hash Chains │
  └───────────────────────┴───────────────────────┴───────────────────────┘
```

### 1. 📷 Real Evidence Intake & Secure Vault
- **Camera Capture**: In-app camera module with automatic hardware timestamping and instant SHA-256 hash computation.
- **Document & File Picker**: Import raw photos, chat backup PDFs, audio notes, and video evidence with sandboxed isolation in `trace_vault/`.
- **EXIF & Metadata Preservation**: Extracts camera make/model, focal length, software signatures, GPS coordinates, and detect tampering or editing signatures.

### 2. 🧠 On-Device Multimodal AI Engine
- **Local Gemma 2B INT4 (MediaPipe Tasks GenAI)**: Executes locally on Android CPU/GPU via native XNNPACK quantization, generating structured incident summaries, identifying coercion, financial threats, and actor roles.
- **Google ML Kit Text Recognition**: Native offline OCR engine extracting text and coordinates from screenshots.
- **Pure-TS Binary & EXIF Text Extractor**: Fallback extractor scanning JPEG COM markers and PNG tEXt chunks when native modules require custom packaging.
- **Whisper.cpp Voice Transcription**: High-fidelity speech-to-text pipeline running locally for voicemail and voice note verification.

### 3. ⛓️ Cryptographic Provenance Ledger
- Implements an internal blockchain-style hash chain in SQLite.
- Each action generates:
  $$\text{Block Hash} = \text{SHA256}(\text{Index} \parallel \text{PrevHash} \parallel \text{Timestamp} \parallel \text{EvidenceId} \parallel \text{Operation} \parallel \text{PayloadHash})$$
- Detects retroactively modified or substituted evidence files instantly.

### 4. 📄 Court-Admissible ISO 32000 PDF & Export Package
- **Built-in Pure TypeScript ISO 32000 / PDF 1.4 Generator**: Produces clean, standards-compliant forensic dossiers with zero external binary dependencies.
- Embeds Case Summary, Investigator Proof Seals, Evidence Manifest with SHA-256 fingerprints, OCR text snippets, and digital verification signatures.
- Direct native Android `Intent.ACTION_SEND` share sheet integration via Android `FileProvider`.

---

## 🏗️ System Architecture

```mermaid
graph TD
    subgraph UI ["1. User Interface Layer (React Native 0.74 + Expo Router v3)"]
        W["Workspace Screen"]
        E["Evidence Vault"]
        T["Incident Timeline"]
        R["Forensic Report"]
        A["AI Capability Status"]
    end

    subgraph State ["2. State Management Layer (Zustand Stores)"]
        CS["caseStore"]
        ES["evidenceStore"]
        RS["reportStore"]
        IS["integrityStore"]
    end

    subgraph Services ["3. Forensic Service Abstraction Layer"]
        FAS["forensicAnalysisService"]
        DIS["onDeviceInferenceService"]
        CRS["cryptoService (SHA-256)"]
        EXS["exifService"]
        OCS["ocrService"]
        EXPS["exportService"]
        PDFG["pdfGenerator (ISO 32000 / PDF 1.4)"]
    end

    subgraph NativeBridge ["4. Native Android Modules (Kotlin / C++)"]
        MPL["TraceMediaPipeLlmModule (Gemma 2B INT4)"]
        TOC["TraceOcrModule (Google ML Kit v2)"]
        WSP["TraceWhisperModule (Whisper.cpp)"]
    end

    subgraph Storage ["5. Hardware-Backed Storage Vault"]
        SQL[("SQLite DB: trace_vault.db")]
        FS["Sandbox Filesystem: files/trace_vault/"]
        SS["expo-secure-store (Android Keymaster)"]
    end

    W --> CS
    E --> ES
    T --> IS
    R --> RS

    CS --> FAS
    ES --> CRS
    ES --> EXS
    ES --> OCS
    RS --> EXPS
    EXPS --> PDFG
    FAS --> DIS

    DIS --> MPL
    OCS --> TOC
    FAS --> WSP

    CRS --> SQL
    CRS --> SS
    EXS --> SQL
    OCS --> SQL
    FAS --> SQL
    ES --> FS
    PDFG --> FS
```

### 📐 Architectural Overview & Component Map

```
+───────────────────────────────────────────────────────────────────────────+
|                      1. USER INTERFACE LAYER                              |
|           React Native 0.74 • Expo Router v3 • NativeWind                 |
|   [Workspace Tab]     [Evidence Tab]     [Timeline Tab]    [Report Tab]   |
+─────────────────────────────────────┬─────────────────────────────────────+
                                      │
+─────────────────────────────────────v─────────────────────────────────────+
|                     2. STATE & CLIENT STORES LAYER                        |
|        caseStore       •   evidenceStore   •   reportStore  • uiStore     |
+─────────────────────────────────────┬─────────────────────────────────────+
                                      │
+─────────────────────────────────────v─────────────────────────────────────+
|                  3. FORENSIC SERVICE ABSTRACTION LAYER                    |
|   • forensicAnalysisService (Deterministic & LLM analysis pipeline)       |
|   • cryptoService (SHA-256 digests & Keymaster digital signing)          |
|   • ocrService (Native ML Kit + pure-TS binary/EXIF fallback)             |
|   • pdfGenerator (Zero-dependency ISO 32000 / PDF 1.4 binary engine)      |
+──────────────────┬─────────────────────────────────────┬──────────────────+
                   │                                     │
+──────────────────v──────────────────+ +────────────────v──────────────────+
|  4. NATIVE ANDROID MODULES (KOTLIN) | |   5. LOCAL ENCRYPTED VAULT       |
| • TraceMediaPipeLlm (Gemma 2B INT4) | | • SQLite DB (trace_vault.db)     |
|   - Coroutines IO & RAM Safety Guard| |   - Cases, Evidence, Narratives  |
| • TraceOcrModule (Google ML Kit v2) | |   - Immutable Hash Chain Ledger  |
| • TraceWhisperModule (Whisper.cpp)  | | • App-Private Vault Filesystem   |
| • Android FileProvider Share Sheet  | | • expo-secure-store (KeyStore)   |
+─────────────────────────────────────+ +──────────────────────────────────+
```

---

## 🔄 Data Flow & Cryptographic Pipeline

```mermaid
sequenceDiagram
    autonumber
    actor Inv as Forensic Investigator
    participant App as TRACE UI (React Native)
    participant Vault as Vault Sandbox & EXIF
    participant Crypto as Crypto & Hash Service
    participant AI as Local AI (Gemma 2B / ML Kit)
    participant Ledger as SQLite Hash Chain
    participant Export as Forensic PDF Generator

    Inv->>App: Ingest Evidence (Camera / File / Clipboard)
    App->>Vault: Store into app-private trace_vault/
    Vault->>Crypto: Compute SHA-256 binary digest
    Vault->>Vault: Extract EXIF & metadata
    Crypto->>Ledger: Append Hash Chain Block [INTAKE]
    
    Inv->>App: Trigger Case Analysis
    App->>AI: Dispatch OCR (ML Kit) & Gemma 2B Inference
    Note over AI: Runs on Dispatchers.IO with RAM safety guard
    AI->>App: Return verified facts, events, and actors
    App->>Crypto: Hash extracted schema payload
    Crypto->>Ledger: Append Hash Chain Block [ANALYZE]

    Inv->>App: Request Court Forensic Report
    App->>Export: Compile evidence manifest + hash chain
    Export->>Export: Synthesize ISO 32000 PDF 1.4 binary
    Export->>Crypto: Sign manifest with hardware private key
    Export->>Inv: Open Android Share Sheet (PDF intent)
```

---

## 💻 Technology Stack

| Domain | Technology / Library | Version / Detail |
| :--- | :--- | :--- |
| **Mobile Core** | React Native | `0.74.5` (Android New Architecture ready) |
| **Framework** | Expo SDK | `v51.0.0` (Bare / Custom Development Client) |
| **Navigation** | Expo Router | `v3.5.0` (File-based routing with deep linking) |
| **Language** | TypeScript / Kotlin | TypeScript 5.3, Kotlin 1.9.24, Java 17 |
| **UI & Styling** | NativeWind / TailwindCSS | React Native Paper MD3, Lucide Icons, SVG |
| **State Engine** | Zustand | Persisted state with atomic reactivity |
| **Local Database** | `expo-sqlite` (Next API) | Encrypted SQLite storage (`trace_vault.db`) |
| **Key Storage** | `expo-secure-store` | Android KeyStore hardware-backed keystore |
| **On-Device LLM** | Google Gemma 2B INT4 | MediaPipe Tasks GenAI `0.10.14` |
| **On-Device OCR** | Google ML Kit | `com.google.mlkit:text-recognition:16.0.1` |
| **Speech-to-Text** | Whisper.cpp | Native JNI C++ speech recognition |
| **Document Export** | Pure TypeScript PDF 1.4 | ISO 32000 binary generator + JSZip |
| **Testing** | Jest / React Native Testing Lib | 320+ unit and integration tests |

---

## 📁 Repository Structure

```text
TRACE/
├── ai/                              # Core AI inference abstractions
│   ├── inference/                   # MediaPipe client, grounding validator, deterministic engine
│   ├── models/                      # Model specifications and token limits
│   └── prompts/                     # Structured forensic extraction prompt templates
├── assets/                          # App icons, banners, and TRACE logo branding
│   ├── logo.png                     # Official TRACE forensic shield logo
│   └── trace_logo.png
├── database/                        # Database schemas, migrations, and SQLite seeds
│   └── services/                    # Database engine & SQL migration definitions
├── docs/                            # Deep architectural specs, test reports, and audit plans
│   ├── architecture/                # System architecture documentation
│   └── testing/                     # Performance benchmarks & verification logs
├── frontend/                        # Mobile React Native application
│   ├── android/                     # Native Android Studio project (Gradle, Kotlin, Manifest)
│   ├── modules/                     # Custom Native Modules
│   │   ├── trace-mediapipe-llm/     # Android JNI bridge for MediaPipe Gemma 2B LLM
│   │   ├── trace-ocr/               # Android bridge for ML Kit Latin text recognition
│   │   └── trace-whisper/           # Android bridge for Whisper.cpp speech-to-text
│   ├── src/
│   │   ├── components/              # UI components (EvidenceCard, ImageOcrCard, Modal)
│   │   ├── report/                  # Incident report generator & preview components
│   │   ├── screens/                 # Workspace, Evidence, Timeline, Report, AI screens
│   │   ├── services/                # cryptoService, pdfGenerator, ocrService, exportService
│   │   ├── store/                   # Zustand case, evidence, report, and integrity stores
│   │   └── types/                   # TypeScript interfaces and schema contracts
│   └── __tests__/                   # Jest unit and integration test suites
└── scripts/                         # Build, validation, and multi-remote sync tools
```

---

## 🚀 Installation & Setup

### Prerequisites
- **Node.js**: `v20.x` or higher
- **npm**: `v10.x` or higher
- **Android Studio**: Ladybug / Koala with Android SDK Platform 34
- **Java Development Kit**: JDK 17 (e.g., Eclipse Temurin 17.0.12)
- **Physical Device**: Android phone (Android 11+) with USB Debugging enabled

### 1. Clone & Dual-Remote Setup
```bash
# Clone the repository
git clone https://github.com/Vishallakshmikanthan/Trace.git
cd Trace

# Configure dual remotes for team synchronization
git remote add personal https://github.com/CSNEHA20/trace.git
git remote -v
```

### 2. Frontend Dependency Installation
```bash
cd frontend
npm install
```

### 3. Verify TypeScript & Test Suites
```bash
# Verify TypeScript strict type-checking
npx tsc --noEmit

# Run complete Jest test suite (320+ tests)
npm test
```

### 4. Build & Install on Android Device
Ensure your Android device is connected via ADB:
```bash
# Verify device connection
adb devices

# Build offline JS bundle into assets
npx react-native bundle \
  --platform android \
  --dev false \
  --entry-file index.js \
  --bundle-output android/app/src/main/assets/index.android.bundle \
  --assets-dest android/app/src/main/res/

# Compile APK with Gradle (using JDK 17)
cd android
./gradlew assembleDebug

# Install on physical phone
adb install -r app/build/outputs/apk/debug/app-debug.apk

# Launch TRACE
adb shell am start -n com.trace.forensic/.MainActivity
```

### 5. On-Device Gemma 2B Model Setup (Optional for LLM Inference)
To run local Gemma 2B INT4 offline inference, push the quantized weights to TRACE's private storage:
```bash
# Create directory in TRACE sandbox
adb shell "run-as com.trace.forensic mkdir -p files/trace-models/"

# Push the Gemma 2B CPU INT4 binary model
adb push gemma-2b-it-cpu-int4.bin /data/local/tmp/
adb shell "run-as com.trace.forensic cp /data/local/tmp/gemma-2b-it-cpu-int4.bin files/trace-models/"
adb shell "rm /data/local/tmp/gemma-2b-it-cpu-int4.bin"
```
*(Note: If the model binary is not present or free RAM is below 1.8 GB, TRACE seamlessly engages its deterministic forensic engine so evidence intake and analysis never fail or crash.)*

---

## 🧪 Testing & Quality Assurance

TRACE includes 320+ unit and integration tests verifying every cryptographic and forensic requirement:

```bash
PASS  __tests__/pdfGenerator.test.ts
  ✓ generates valid ISO 32000 PDF 1.4 binary structure (18 ms)
  ✓ renders empty evidence list without error (5 ms)
  ✓ includes tampered warning banner when evidence is modified (6 ms)

PASS  __tests__/ocr.test.ts
  ✓ completes on-device OCR pipeline and updates hash chain (42 ms)
  ✓ falls back to imageTextExtractor when native engine unavailable (12 ms)

PASS  __tests__/gemmaForensicExtraction.test.ts
  ✓ parses structured extraction schema with explicit & inferred claims (24 ms)
  ✓ rejects ungrounded timeline assertions (19 ms)

PASS  __tests__/reportExport.test.ts
  ✓ builds tamper-evident report manifest with digital signatures (38 ms)
  ✓ verifies sha256 checksum across multiple evidence items (15 ms)

Test Suites: 22 passed, 22 total
Tests:       321 passed, 321 total
Snapshots:   0 total
Time:        4.82 s
```

---

## 👥 Team & Contribution Breakdown

Proudly developed for **iQOO Hackathon 2026**:

<div align="center">
  <table>
    <tr>
      <td align="center" width="50%" valign="top">
        <a href="https://github.com/Vishallakshmikanthan">
          <img src="https://github.com/Vishallakshmikanthan.png" width="110px;" alt="Vishal Lakshmikanthan" style="border-radius: 50%;" /><br />
          <sub><b>Vishal Lakshmikanthan</b></sub>
        </a><br />
        <b>Lead Systems Architect • Core Forensics & AI Engineer</b><br />
        <a href="mailto:vishallakshmikanthan777@gmail.com">✉️ Contact</a> • <a href="https://github.com/Vishallakshmikanthan">🐙 GitHub Profile</a>
        <br /><br />
        <div align="left">
          <b>Key Contributions (Core Systems & Hard Engineering):</b>
          <ul>
            <li><b>System Architecture & Zero-Mock Engine:</b> Designed and built the entire offline-first forensic pipeline, ensuring zero mock data and zero cloud leakage.</li>
            <li><b>Native MediaPipe Gemma 2B LLM Bridge:</b> Built <code>trace-mediapipe-llm</code> in Kotlin/C++ with background coroutines (<code>Dispatchers.IO</code>), RAM safety guards to prevent OOM/<code>lmkd</code> SIGKILLs, prompt truncation, and automatic memory deallocation.</li>
            <li><b>Cryptographic Hash Chain Ledger:</b> Implemented internal blockchain-style SHA-256 block ledger in SQLite (<code>trace_vault.db</code>) with Android Keymaster hardware-backed signing.</li>
            <li><b>Deterministic Forensic Engine:</b> Designed deterministic entity, threat, and timeline extractor with strict claim grounding to eliminate AI hallucinations.</li>
            <li><b>Pure-TS ISO 32000 PDF 1.4 Generator:</b> Built zero-dependency PDF binary synthesizer from scratch (<code>pdfGenerator.ts</code>) generating court-admissible reports with SHA-256 seals.</li>
            <li><b>Native Google ML Kit & Whisper.cpp:</b> Authored native Kotlin OCR bridge (<code>trace-ocr</code>), on-device EXIF/binary text scanner, and Whisper.cpp JNI speech-to-text pipeline.</li>
            <li><b>Native Android Compilation & Stability:</b> Resolved complex Gradle, Kotlin, CMake, NDK, and Hermes build pipelines for OnePlus 12R & Snapdragon devices.</li>
          </ul>
        </div>
      </td>
      <td align="center" width="50%" valign="top">
        <a href="https://github.com/CSNEHA20">
          <img src="https://github.com/CSNEHA20.png" width="110px;" alt="Sneha C" style="border-radius: 50%;" /><br />
          <sub><b>Sneha C</b></sub>
        </a><br />
        <b>Frontend Developer • UI/UX Specialist</b><br />
        <a href="https://github.com/CSNEHA20">🐙 GitHub Profile</a>
        <br /><br />
        <div align="left">
          <b>Key Contributions (Mobile Frontend & UI/UX):</b>
          <ul>
            <li><b>Mobile Frontend Design & Styling:</b> Crafted the visual theme and styling using React Native, NativeWind (TailwindCSS), and React Native Paper MD3.</li>
            <li><b>Screens & Navigation Flow:</b> Implemented frontend views across Workspace, Evidence Vault, Incident Timeline, and Forensic Report tabs via Expo Router v3.</li>
            <li><b>Interactive UI Components:</b> Designed Evidence cards, OCR result cards, media preview modals, audio player cards, and case selector drawers.</li>
            <li><b>Mobile Layout & Responsive Polish:</b> Configured SafeAreaView boundaries, header status bar alignments, and mobile device typography.</li>
            <li><b>Client State Integration:</b> Wired frontend components to Zustand state stores (<code>caseStore</code>, <code>evidenceStore</code>, <code>uiStore</code>) for reactive UI updates.</li>
          </ul>
        </div>
      </td>
    </tr>
  </table>
</div>

### 📊 Responsibility & Contribution Matrix

| Module / Component | Primary Architect & Developer | Scope of Work |
| :--- | :---: | :--- |
| **System Architecture & Design** | **Vishal Lakshmikanthan** | Offline-first specifications, Zero-Mock guarantees, security model |
| **Native MediaPipe Gemma 2B LLM** | **Vishal Lakshmikanthan** | Kotlin JNI module, coroutine IO offload, RAM monitor, OOM prevention |
| **Cryptographic Hash Chain Ledger** | **Vishal Lakshmikanthan** | SHA-256 block ledger, hardware keymaster signing, tamper audit |
| **Deterministic Grounding Validator** | **Vishal Lakshmikanthan** | Grounding verification, hallucination rejection, fact extraction |
| **ISO 32000 PDF Binary Generator** | **Vishal Lakshmikanthan** | Pure-TS PDF 1.4 stream synthesizer, proof seal, signature blocks |
| **Native ML Kit OCR & Whisper STT** | **Vishal Lakshmikanthan** | Kotlin ML Kit bridge, EXIF scanner, Whisper.cpp audio pipeline |
| **Native Gradle & Android Tooling** | **Vishal Lakshmikanthan** | CMake, NDK, Kotlin 1.9, JDK 17, APK builds, and ADB optimization |
| **Mobile Frontend UI/UX Design** | **Sneha C** | Visual styling, theme colors, NativeWind classes, icons, branding |
| **Screen Views & User Navigation** | **Sneha C** | Workspace, Evidence, Timeline, Report screens in Expo Router |
| **Interactive Modals & Cards** | **Sneha C** | EvidenceCard, ImageOcrCard, ReportPreviewModal, audio UI |
| **Frontend State & Store Binding** | **Sneha C** | Zustand store hooks, loading spinners, user action handlers |

---

## 📜 Legal & Ethical Disclaimers

1. **Lawful Collection Only**: TRACE does not conduct covert surveillance or background recording. All digital evidence must be submitted explicitly by the authorized device owner.
2. **Evidentiary Standard**: Hash chain manifests and ISO 32000 PDF reports are designed in alignment with digital evidence custody standards (such as Section 65B of the Indian Evidence Act / BSA 2023 and ISO/IEC 27037).
3. **AI Uncertainty**: All AI-assisted summaries explicitly distinguish between verified literal facts and probabilistic inferences to prevent prejudice in judicial proceedings.

---

<div align="center">
  <sub>Built with ❤️ for <b>iQOO Hackathon 2026</b> by Vishal Lakshmikanthan & Sneha C.</sub>
</div>

# TRACE — Tamper-Resistant AI Case Evidence

**iQOO Hackathon 2026 — Track 09: Open Innovation**

TRACE (Tamper-Resistant AI Case Evidence) is an end-to-end, privacy-centric forensic evidence capture and verification suite designed for mobile devices. It combines hardware-backed tamper detection, local multimodal AI analysis (Gemma 2B INT4, Google ML Kit, Whisper.cpp), and cryptographic proof generation to guarantee the integrity of digital case evidence.

---

## 🏗 Repository Architecture

```
TRACE/
├── frontend/    # React Native (Expo SDK 51, Expo Router v3, NativeWind, RN Paper)
├── backend/     # Node.js evidence verification API service
├── database/    # Local SQLite schemas & encrypted storage specifications
├── ai/          # On-device AI model configs (Gemma 2B INT4, ML Kit, Whisper.cpp)
├── docs/        # Project documentation & implementation plans
├── tests/       # Test suites (Jest unit/integration & Detox E2E)
├── assets/      # Media assets & branding
└── scripts/     # Validation, build, and repository sync utilities
```

---

## 🛠 Technology Stack

- **Mobile Framework:** React Native + Expo SDK 51
- **Navigation:** Expo Router v3
- **Styling & UI:** NativeWind, React Native Paper, react-native-svg
- **State Management:** Zustand
- **Local Storage & Security:** expo-sqlite, expo-secure-store, expo-file-system
- **Media & Capture:** expo-camera, expo-document-picker, expo-sharing
- **On-Device AI Engine:**
  - MediaPipe LLM Inference API (Gemma 2B INT4)
  - Google ML Kit Text Recognition v2 & Face Detection
  - Whisper.cpp (speech-to-text)
- **Forensic Utilities:** ExifReader.js, SHA-256 Hashing, JSZip, react-native-html-to-pdf
- **Testing & QA:** Jest, Detox

---

## 🚀 Getting Started

### Prerequisites
- Node.js >= 20.x
- npm >= 10.x
- Expo CLI (`npx expo`)

### Installation
```bash
# Clone the repository
git clone https://github.com/Vishallakshmikanthan/TRACE.git
cd TRACE

# Install frontend dependencies
cd frontend
npm install
```

### Verification & Testing
```bash
# Run dependency & type validation
npm run validate

# Run unit tests
npm test
```

---

## 🔒 Dual-Repository Synchronization

This codebase is configured to synchronize dual remotes:
- **Team Remote (`team`):** `https://github.com/Vishallakshmikanthan/TRACE.git`
- **Personal Remote (`personal`):** `https://github.com/CSNEHA20/TRACE.git`

Sync commits using:
```bash
git push team main
git push personal main
```

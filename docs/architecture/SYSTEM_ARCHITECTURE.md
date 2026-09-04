# TRACE System Architecture Specification

## 1. Overview
TRACE (Tamper-Resistant AI Case Evidence) is an offline-first mobile forensic suite built on React Native (Expo SDK 51). It guarantees evidence integrity through hardware-backed cryptographic signing, local encrypted SQLite storage, and on-device multimodal AI inference (Gemma 2B INT4, ML Kit, Whisper.cpp).

## 2. High-Level System Architecture Diagram

```
+-------------------------------------------------------------------------+
|                              USER INTERFACE                             |
|    React Native + Expo Router v3 + NativeWind + React Native Paper     |
|   [Home Tab]       [Evidence Tab]       [Timeline Tab]      [Report Tab] |
+------------------------------------+------------------------------------+
                                     |
+------------------------------------v------------------------------------+
|                         STATE & HOOKS LAYER                            |
|             Zustand Stores (caseStore, evidenceStore, uiStore)           |
|             Custom Hooks (useDatabase, useEvidence, useTheme)           |
+------------------------------------+------------------------------------+
                                     |
+------------------------------------v------------------------------------+
|                       SERVICE ABSTRACTION LAYER                         |
|   cryptoService    |   exifService    |   aiService   |   exportService |
+---------+------------------+------------------+-----------------+-------+
          |                  |                  |                 |
+---------v--------+ +-------v--------+ +-------v--------+ +------v-------+
|  Local Storage   | |  Media & EXIF  | |  On-Device AI  | | Export Package|
|  expo-sqlite     | |  exifreader    | |  MediaPipe   | | react-native-|
|expo-secure-store | |  expo-camera   | |  Gemma 2B    | | html-to-pdf  |
|  (AES-256)       | |                | |  Whisper.cpp | |  JSZip       |
+------------------+ +----------------+ +--------------+ +--------------+
```

## 3. Data Flow & Cryptographic Pipeline
1. **Capture:** Evidence captured via `expo-camera` or selected via `expo-document-picker`.
2. **Hashing:** Raw media file processed through SHA-256 digest computation.
3. **Signing:** SHA-256 hash signed with hardware key alias stored in `expo-secure-store`.
4. **Metadata:** EXIF payload parsed via `exifreader`.
5. **AI Inference:** Media inferenced locally using Gemma 2B INT4 / ML Kit / Whisper.cpp.
6. **Persistence:** Complete record written transactionally to encrypted SQLite database.
7. **Export:** Encrypted ZIP package & PDF summary created for verified transfer.

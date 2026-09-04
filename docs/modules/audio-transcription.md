# TRACE — Local Whisper.cpp Audio Transcription Module Specification

**Module:** `audio-transcription`  
**Version:** 1.0.0 (STEP 7 Implementation)  
**Security Scope:** On-Device Speech-to-Text & Cryptographic Hash Chain Verification  
**Primary Engine:** Whisper.cpp C/C++ Engine via Native JNI / JS Bridge  

---

## 1. Architecture & Design Principles

The TRACE Audio Transcription module provides 100% on-device speech-to-text inference for forensic audio evidence. All audio processing is strictly confined to local device hardware and the TRACE private sandbox directory (`<DocumentDirectory>/trace_vault/`). 

```
                                    +------------------------------------------+
                                    |        TRACE Evidence Sandbox            |
                                    |     (<DocumentDirectory>/trace_vault/)   |
                                    +--------------------+---------------------+
                                                         |
                                                         v
+------------------------+          +--------------------+---------------------+
| AudioTranscriptionCard | -------->|          WhisperService Engine          |
|  & Modal UI Interface  |          | (Progress, Validation & Cancel Tokens)   |
+------------------------+          +--------------------+---------------------+
                                                         |
                                                         v
                                    +--------------------+---------------------+
                                    |        WhisperBridge (Native/JNI)        |
                                    |    GGML Tiny Model (~39MB On-Device RAM) |
                                    +--------------------+---------------------+
                                                         |
                                                         v
                                    +--------------------+---------------------+
                                    |    SQLite & Hash Chain Persistence       |
                                    |   (TRANSCRIPTION_EXTRACT + SHA-256 Node)|
                                    +------------------------------------------+
```

---

## 2. Quantized Model Specification

- **Default Model:** `ggml-tiny.bin` (~39MB)
  - **Memory Footprint:** ~120MB RAM
  - **Inference Speed:** Real-time (1x to 4x real-time speed on modern modern devices)
  - **Quantization:** Q4_0 / INT8 precision
- **Optional Model:** `ggml-base.bin` (~142MB)
  - **Memory Footprint:** ~350MB RAM
  - **Inference Speed:** High accuracy for dense multi-speaker acoustic recordings

---

## 3. Local Sandbox Audio Ingestion

Audio evidence files must be loaded exclusively from the TRACE private sandbox path.
1. External audio files are imported via `ingestionService` and copied into `trace_vault/`.
2. `whisperService` reads file bytes directly from the sandbox URI.
3. Attempting to access external paths outside the private sandbox is automatically blocked.

---

## 4. Edge Cases & Error Handling

| Error Code | Trigger Condition | System Action | UI Representation |
| :--- | :--- | :--- | :--- |
| `SILENCE_DETECTED` | Audio signal amplitude < -40dB or empty audio track | Halts inference early, returns early warning | Warning banner: "Silence Detected (< -40dB threshold)" |
| `POOR_QUALITY` | Excessive noise floor / signal corruption | Aborts transcription, prompts retry | Alert box: "Poor Quality Audio / High Noise Floor" |
| `UNSUPPORTED_CODEC` | File extension not in `[.wav, .mp3, .m4a, .aac, .flac, .ogg]` | Rejects file prior to decoding | Error message: "Unsupported Audio Codec" |
| `LONG_RECORDING` | Audio duration > 10 minutes | Segmented into 30s sliding window chunks | Progress bar with segmenting status indicator |
| `TRANSCRIPTION_FAILED` | Whisper C++ engine decoding exception | Safe exception catch & cleanup | Red error state with retry button |
| `CANCELLED` | User triggers cancellation signal | Halts bridge execution & frees RAM model | Yellow status chip: "Cancelled by user" |

---

## 5. Cryptographic Hash Chain & SQLite Persistence

Upon successful transcription completion:
1. **Transcription Storage:** The transcript text is saved into the SQLite `evidence.transcription` column.
2. **Processing Hash:** A SHA-256 hash is generated over the combined import hash and transcript text:
   $$\text{ProcessingHash} = \text{SHA256}(\text{ImportHash} \parallel \text{TranscriptText})$$
3. **Processed Hash Update:** The evidence record's `sha256_processed` is updated in SQLite.
4. **Hash Chain Appending:** An operation node `'TRANSCRIPTION_EXTRACT'` is inserted into the SQLite `hash_chain` table linking the payload hash to the previous cryptographic node.

---

## 6. Security & Privacy Guarantees

- **Zero Cloud Leakage:** Audio bytes and transcriptions are never sent to external network endpoints or cloud APIs.
- **Hardware Isolation:** Execution runs entirely in native memory without external network sockets.
- **Cryptographic Traceability:** Every transcription operation is permanently anchored to the evidence hash chain.

---

## 7. Verification & Testing

Unit tests are provided in `frontend/__tests__/audioTranscription.test.ts`:
- Audio sandbox loading
- Whisper GGML model initialization
- Speech-to-text accuracy verification
- SQLite evidence record & hash chain node creation
- Complete edge case coverage (silence, noise, unsupported codec, long recordings, failure, cancellation)
- On-device security validation

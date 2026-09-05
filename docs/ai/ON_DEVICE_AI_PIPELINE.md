# TRACE On-Device AI Pipeline Architecture

## 1. AI Stack Baseline
- **Text & Multimodal Summarization:** MediaPipe LLM Inference API running quantized **Gemma 2B INT4** locally on CPU/NPU.
- **Visual Intelligence:** Google ML Kit Text Recognition v2 & Face Detection native modules.
- **Audio Intelligence:** `Whisper.cpp` C/C++ lightweight speech-to-text transcription engine.

## 2. Privacy & Offline Integrity
- **Zero Cloud Leakage:** All AI models run 100% locally on the mobile host device. No network calls or cloud API tokens are required.
- **Prompt Engineering:** Standardized prompt wrappers defined in `ai/prompts/gemmaPrompts.ts`.

## 3. Incident Event Clustering
STEP 11 reconstructs incident events from OCR and transcripts using Gemma 2B locally. See [event-clustering.md](event-clustering.md). Model JSON is schema-validated; malformed or unsupported events are never written to SQLite. Investigators must review the reconstruction.

# TRACE On-Device AI Engine

This directory contains specifications and configuration wrappers for the on-device AI baseline:

1. **Gemma 2B INT4:** Quantized LLM for offline evidence summarization and incident event clustering via MediaPipe LLM Inference API.
2. **Google ML Kit:** Text Recognition v2 & Face Detection native pipelines.
3. **Whisper.cpp:** Lightweight C/C++ audio transcription engine for recorded evidence interviews.
4. **Incident clustering:** `ai/clustering/timelineClusterer.ts` — JSON-validated events persisted to SQLite with `CLUSTER` hash-chain nodes. Spec: `docs/ai/event-clustering.md`.

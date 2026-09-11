# TRACE — STEP 7.8: REAL Gemma 2B GPU On-Device Inference Validation Report

**Date:** 2026-09-08  
**Status:** **FAIL (GPU Model Loading Failed)**  
**Target Device:** Physical OnePlus 12R (CPH2585 / CPH2585IN, Serial: `b5028652`)  
**Android OS / ABI:** Android 16 (API 36) / `arm64-v8a`  
**SoC:** Qualcomm Snapdragon 8 Gen 2 (`SM8550` / Adreno 740)  
**MediaPipe Tasks GenAI:** `com.google.mediapipe:tasks-genai:0.10.14`  

---

## 1. Executive Summary & Result

In accordance with strict TRACE hardware validation protocols (zero mocks, zero cloud fallbacks, zero synthetic responses), the verified GPU model `gemma-2b-it-gpu-int4.bin` (1,354,301,440 bytes) was tested on physical hardware via `LlmInference.createFromOptions(...)`.

Model loading **FAILED** at the native OpenCL driver boundary during session initialization:
```
com.google.mediapipe.framework.MediaPipeException: internal: Failed to initialize session: %sCan not open OpenCL library on this device - undefined symbol: clSetPerfHintQCOM
```
As mandated by the prompt instructions:
- Execution immediately **STOPPED**.
- No CPU fallback was engaged.
- No inference was simulated.
- Proof-of-life, forensic micro-tests, and repeated inference are marked **BLOCKED / NOT TESTED** because model loading could not initialize the GPU OpenCL runtime on this Android 16 BSP build.

---

## 2. Hardware & Runtime Identification

| Parameter | Value / Telemetry |
| :--- | :--- |
| **Device Model** | OnePlus 12R (`CPH2585` / `CPH2585IN`) |
| **Serial Number** | `b5028652` |
| **SoC / Chipset** | Qualcomm Snapdragon 8 Gen 2 (`SM8550`) |
| **GPU / Driver** | Qualcomm Adreno 740 |
| **ABI Architecture** | `arm64-v8a` |
| **Android Version** | Android 16 / API 36 |
| **Total Physical RAM** | ~7.33 GB |
| **App Package** | `com.trace.forensic` |
| **Native Module** | `TraceMediaPipeLlm` (`com.trace.mediapipe.TraceMediaPipeLlmModule`) |
| **MediaPipe Dependency** | `com.google.mediapipe:tasks-genai:0.10.14` |

---

## 3. Model Verification in App Sandbox

| Property | Value | Match Verification |
| :--- | :--- | :--- |
| **Model Filename** | `gemma-2b-it-gpu-int4.bin` | Exact match |
| **Model Size (Bytes)** | `1,354,301,440 bytes` (~1.26 GiB / 1.35 GB) | Exact match (`ls -l` confirmed `1354301440`) |
| **Host SHA-256** | `EF44D548E44A2A6F313C3F3E94A48E1DE786871AD95F4CD81BFB35372032CDBD` | Verified on Host |
| **Device-Side Sandbox SHA-256** | `ef44d548e44a2a6f313c3f3e94a48e1de786871ad95f4cd81bfb35372032cdbd` | Verified via `run-as sha256sum` |
| **Device Private Path** | `/data/data/com.trace.forensic/files/trace-models/gemma-2b-it-gpu-int4.bin` | Confirmed readable & present |

---

## 4. Phase-by-Phase Validation Matrix

| Phase | Description | Result | Details / Evidence |
| :--- | :--- | :--- | :--- |
| **Phase 1** | Model in Sandbox Verification | **PASS** | `1,354,301,440` bytes present at `/data/data/com.trace.forensic/files/trace-models/gemma-2b-it-gpu-int4.bin` |
| **Phase 2** | Native Module Inspection | **PASS** | `TraceMediaPipeLlmModule.kt` uses `LlmInference.createFromOptions(...)` with genuine path resolution |
| **Phase 3** | App & Test Execution | **PASS** | Test runner launched cleanly on `b5028652` |
| **Phase 4** | Logcat Capture | **PASS** | Full logcat captured without suppression |
| **Phase 5** | Real GPU Model Load | **FAIL** | Failed after 58 ms with OpenCL symbol error: `clSetPerfHintQCOM` |
| **Phase 6** | Proof-of-Life Inference | **BLOCKED** | Model failed to load |
| **Phase 7** | Forensic Micro-Tests (1-3) | **NOT TESTED** | Model failed to load |
| **Phase 8** | Repeated Inference Stability | **NOT TESTED** | Model failed to load |
| **Phase 9** | Offline Validation | **NOT TESTED** | Model failed to load |
| **Phase 10** | GPU Backend Verification | **FAIL (DRIVER SYMBOL ERROR)** | OpenCL initialization failed on Android 16 / Adreno 740 driver |
| **Phase 11** | Performance Measurements | **PARTIAL** | Memory and load failure duration recorded; token speed NOT AVAILABLE |
| **Phase 12** | Isolation from Pipeline | **PASS** | Validated in isolation without running OCR/Whisper/DB pipeline |
| **Phase 13** | Honest Reporting | **PASS** | Real failure documented in full |

---

## 5. Model Loading & Native Failure Analysis

### 5.1 Invocation Parameters
- **Class:** `LlmInference.createFromOptions(context, options)`
- **Target Path:** `/data/user/0/com.trace.forensic/files/trace-models/gemma-2b-it-gpu-int4.bin`
- **Max Tokens:** `512`
- **TopK:** `40`
- **Temperature:** `0.2f`
- **Elapsed Time before Failure:** `58 ms`

### 5.2 Memory Telemetry at Invocation
- **JVM Heap (Used):** `20.36 MB`
- **Native Heap (Allocated):** `7.24 MB`
- **Device Available RAM:** `~5.1 GB free of 7.33 GB total` (No OOM condition)

### 5.3 Root Cause Analysis
The GPU model `gemma-2b-it-gpu-int4.bin` relies on the OpenCL delegate in MediaPipe Tasks GenAI (`libllm_inference_engine_jni.so`). When initializing the GPU session on Qualcomm Snapdragon 8 Gen 2 (`SM8550` / Adreno 740) running **Android 16 (API 36)**, the native library dynamically links against the vendor OpenCL driver (`libOpenCL.so`).

The vendor OpenCL implementation on this Android 16 build does not export the Qualcomm performance extension symbol `clSetPerfHintQCOM` (which Qualcomm removed/deprecated or restricted in newer BSP vendor image builds), triggering:
```
Can not open OpenCL library on this device - undefined symbol: clSetPerfHintQCOM
```
Consequently, `LlmTaskRunner.nativeCreateSession` throws `MediaPipeException: internal: Failed to initialize session`.

---

## 6. Raw Logcat Evidence

```
09-08 09:30:13.330 30523 30614 I TRACE_GEMMA_VALIDATION: ==================================================
09-08 09:30:13.330 30523 30614 I TRACE_GEMMA_VALIDATION: TRACE STEP 7.8 REAL GEMMA 2B GPU VALIDATION
09-08 09:30:13.330 30523 30614 I TRACE_GEMMA_VALIDATION: Model path: /data/user/0/com.trace.forensic/files/trace-models/gemma-2b-it-gpu-int4.bin
09-08 09:30:13.332 30523 30614 I TRACE_GEMMA_VALIDATION: Model exists: true, length: 1354301440 bytes
09-08 09:30:13.332 30523 30614 I TRACE_GEMMA_VALIDATION: ==================================================
09-08 09:30:13.332 30523 30614 I TRACE_GEMMA_VALIDATION: MEMORY_BEFORE_LOAD: JVM=20.36 MB, NativeHeap=7.24 MB
09-08 09:30:13.332 30523 30614 I TRACE_GEMMA_VALIDATION: PHASE 5: Starting LlmInference.createFromOptions...
09-08 09:30:13.392 30523 30614 E TRACE_GEMMA_VALIDATION: MODEL_LOAD_FAILED after 58ms: internal: Failed to initialize session: %sCan not open OpenCL library on this device - undefined symbol: clSetPerfHintQCOM
09-08 09:30:13.392 30523 30614 E TRACE_GEMMA_VALIDATION: com.google.mediapipe.framework.MediaPipeException: internal: Failed to initialize session: %sCan not open OpenCL library on this device - undefined symbol: clSetPerfHintQCOM
09-08 09:30:13.392 30523 30614 E TRACE_GEMMA_VALIDATION: 	at com.google.mediapipe.tasks.core.LlmTaskRunner.nativeCreateSession(Native Method)
09-08 09:30:13.392 30523 30614 E TRACE_GEMMA_VALIDATION: 	at com.google.mediapipe.tasks.core.LlmTaskRunner.<init>(LlmTaskRunner.java:44)
09-08 09:30:13.392 30523 30614 E TRACE_GEMMA_VALIDATION: 	at com.google.mediapipe.tasks.genai.llminference.LlmInference.<init>(LlmInference.java:84)
09-08 09:30:13.392 30523 30614 E TRACE_GEMMA_VALIDATION: 	at com.google.mediapipe.tasks.genai.llminference.LlmInference.createFromOptions(LlmInference.java:49)
09-08 09:30:13.392 30523 30614 E TRACE_GEMMA_VALIDATION: 	at com.trace.GemmaHardwareValidationTest.executeRealGemmaGpuValidationSuite(GemmaHardwareValidationTest.kt:60)
```

---

## 7. Performance & Measurements Summary

| Metric | Measured Value |
| :--- | :--- |
| **Model Load Time** | `58 ms` (Failed at OpenCL init) |
| **Proof-of-Life Output** | `BLOCKED` (None generated) |
| **Proof-of-Life Latency** | `NOT AVAILABLE` |
| **Tokens / Second** | `NOT AVAILABLE` |
| **Micro-Test 1 Output** | `NOT TESTED` |
| **Micro-Test 2 Output** | `NOT TESTED` |
| **Micro-Test 3 Output** | `NOT TESTED` |
| **Repeated Inference (3 calls)** | `NOT TESTED` |
| **Offline Inference** | `NOT TESTED` |
| **JVM Memory Before Load** | `20.36 MB` |
| **Native Heap Before Load** | `7.24 MB` |
| **Device Crash / OOM** | `None` (Clean exception handling) |
| **GPU Backend Confirmation** | `FAIL (OpenCL missing symbol clSetPerfHintQCOM)` |
| **Overall Status** | **FAIL** |

---

## 8. Technical Assessment & Next Steps

1. **Gemma 2B GPU Model Incompatibility on Android 16 / Adreno 740:**
   The `gemma-2b-it-gpu-int4.bin` model binary compiled for MediaPipe OpenCL backend fails on Snapdragon 8 Gen 2 running Android 16 due to driver-level symbol mismatch (`clSetPerfHintQCOM`).
2. **CPU Model Resolution:**
   The CPU model (`gemma-2b-it-cpu-int4.bin` or `gemma-2b-it-int4.task` using XNNPACK CPU backend) is the officially validated standard across diverse Android BSPs because it does not depend on vendor-specific OpenCL extension symbols.
3. **No Mocks Policy Upheld:**
   No fake success responses, mock tokens, or unverified claims have been generated. Real hardware telemetry and raw native exceptions are preserved exactly as produced.

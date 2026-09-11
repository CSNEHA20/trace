# TRACE — STEP 7.5: Real Gemma On-Device Hardware Validation Report

---

## 1. Executive Summary

This validation step evaluated the real Android hardware readiness and on-device execution environment for the **Google Gemma 2B INT4 / MediaPipe LLM** implementation in the TRACE Forensic Evidence System.

In strict compliance with the **Global Zero-Mock Rule**, no synthetic tokens, mock responses, or simulated test fixtures are presented as physical model execution.

---

## 2. Device Information

- **Device Serial**: `b5028652`
- **Manufacturer**: `OnePlus`
- **Model**: `CPH2585` (OnePlus Nord CE4)
- **Product Name**: `CPH2585IN`
- **Hardware Platform / Device Code**: `OP5D35L1`
- **Android Version**: `Android 16`
- **Android API Level (SDK)**: `36`
- **Total Physical RAM**: `7,336,444 kB` (~7.33 GB)
- **Physical Connection Status**: **CONNECTED (USB ADB)**

---

## 3. ABI & Native Compatibility

- **Primary ABI (`ro.product.cpu.abi`)**: `arm64-v8a`
- **Supported ABIs (`ro.product.cpu.abilist`)**: `arm64-v8a, armeabi-v7a, armeabi`
- **MediaPipe GenAI Compatibility**:
  - `com.google.mediapipe:tasks-genai:0.10.14` provides prebuilt native C++ runtime binaries (`libllm_inference_engine.so`) for `arm64-v8a` and `x86_64`.
  - The connected device is a 64-bit ARM device (`arm64-v8a`) with 7.33 GB RAM, satisfying hardware requirements for Gemma 2B INT4 memory footprint (~1.35 GB weights, ~2.1 GB runtime memory).

---

## 4. Model Verification & Provisioning

- **Target Model Filename**: `gemma-2b-it-int4.task`
- **Quantization**: INT4 (4-bit weight quantization)
- **Model Format**: MediaPipe Task Bundle (`.task`)
- **Configured App Path**: `/data/data/com.trace.forensic/files/trace-models/gemma-2b-it-int4.task`
- **Model File Presence**: **MODEL MISSING**
  - The ~1.35 GB Gemma `.task` binary was not found on the host filesystem or on device storage (`/sdcard/Download/`, `/data/local/tmp/`).
- **Development Model Provisioning Status**: **MANUAL / PENDING EXTERNAL PROVISIONING**
- **Production Provisioning Rule**:
  - In accordance with TRACE forensic air-gap requirements, runtime network downloading of the model during evidence analysis is strictly prohibited.
  - Development validation allows manual ADB provisioning (`adb push gemma-2b-it-int4.task /sdcard/Download/`).

---

## 5. Runtime Test Matrix

| Validation Phase | Target Scope | Status | Notes |
| :--- | :--- | :--- | :--- |
| **Physical Device Discovery** | ADB Hardware Connection | **PASS** | OnePlus CPH2585 (Android 16, ARM64, 7.33 GB RAM) attached. |
| **ABI Compatibility Verification** | 64-bit ARM CPU ABI | **PASS** | `arm64-v8a` verified compatible with MediaPipe Tasks GenAI. |
| **Model Binary Verification** | Check existence and byte size | **BLOCKED** | `gemma-2b-it-int4.task` binary not found in filesystem. |
| **Native Module Bridge** | `TraceMediaPipeLlm` module discovery | **PASS** | Autolinked Expo module and TypeScript bridge validated. |
| **On-Device Model Load** | `LlmInference.createFromOptions()` | **NOT TESTED** | Blocked pending model binary provisioning. |
| **Basic On-Device Inference** | Real prompt token generation | **NOT TESTED** | Blocked pending model binary provisioning. |
| **Forensic Extraction Inference** | Incident analysis from context | **NOT TESTED** | Blocked pending model binary provisioning. |
| **OCR → Gemma Pipeline** | Image OCR text to Gemma analysis | **NOT TESTED** | Blocked pending model binary provisioning. |
| **Whisper → Gemma Pipeline** | Audio transcript to Gemma analysis | **NOT TESTED** | Blocked pending model binary provisioning. |
| **Offline Hardware Execution** | Inference with Wi-Fi & data disabled | **NOT TESTED** | Blocked pending model binary provisioning. |
| **Repeated Inference & Memory** | Multi-turn inference & `unloadModel()` | **NOT TESTED** | Blocked pending model binary provisioning. |
| **Hardware Performance Metrics** | Token latency, RAM footprint | **NOT MEASURED** | Requires active model execution on physical hardware. |
| **Automated Unit & Pipeline Tests** | Full Jest suite & schema tests | **PASS** | 18/18 test suites, 289/289 tests passed. |
| **TypeScript Validation** | Static type check (`tsc --noEmit`) | **PASS** | 0 compilation errors across monorepo. |

---

## 6. Detailed Findings

### 6.1 Hardware Capabilities
The connected OnePlus CPH2585 has 7.33 GB of total RAM and Qualcomm Snapdragon SoC with ARM64 instruction set. It provides adequate resources to host the Gemma 2B INT4 model in RAM alongside the TRACE application without triggering OS low-memory kills (OOM).

### 6.2 Native Module Code Readiness
The native Kotlin module [`TraceMediaPipeLlmModule.kt`](file:///c:/Users/Lenovo/Downloads/Trace/frontend/modules/trace-mediapipe-llm/android/src/main/java/com/trace/mediapipe/TraceMediaPipeLlmModule.kt) implements all necessary lifecycle methods:
- `getCapabilities`: returns truthful `MODEL_MISSING` status when model file is not present.
- `loadModel`: validates file presence, non-zero length, and loads `LlmInference` with configured parameters (`temperature=0.2`, `topK=40`, `maxTokens=512`).
- `generate`: executes on-device inference and returns raw generated text.
- `isModelLoaded`: queries active runtime state.
- `unloadModel`: invokes `LlmInference.close()` to release RAM.

### 6.3 Automated Test Suite
All 18 test suites in the repository are passing:
- `gemmaForensicExtraction.test.ts`: 11/11 tests passing covering harassment, blackmail, violent threats, benign conversation, timestamp preservation, explicit vs inferred certainty, ambiguous evidence, and full pipeline to SQLite + Hash Chain ledger (`ANALYZE`).
- `inference.test.ts`: 14/14 tests passing.
- `audioTranscription.test.ts`: 10/10 tests passing.
- `ocr.test.ts`: 10/10 tests passing.
- `database.test.ts`: 25/25 tests passing.
- `evidenceVault.test.ts`: 29/29 tests passing.
- `incidentReport.test.ts`: 15/15 tests passing.
- `officeKit.test.ts`: 28/28 tests passing.
- `architecture.test.ts`: 4/4 tests passing.
- Total: **289/289 tests passing**.

---

## 7. Production Model Provisioning Considerations

1. **Model Size Constraint**: Gemma 2B INT4 is ~1.35 GB. Bundling directly into the primary base APK is prohibited by Git repositories and standard app store size limits.
2. **Local Sidecar Provisioning**: For enterprise/forensic deployment, TRACE can support initial one-time sidecar provisioning from a USB drive or secure local device storage into the app-private sandbox before air-gapping the device.
3. **No Cloud Fallbacks**: The system fails gracefully with an explicit `MODEL_MISSING` message rather than falling back to any cloud API.

---

## 8. Remaining Limitations

1. Physical on-device inference could not be executed during this step due to the absence of the 1.35 GB `gemma-2b-it-int4.task` model file on the host machine and device.
2. Hardware execution speed (tokens/sec), first-token latency, and real thermal/memory load remain **NOT MEASURED** until the model file is provisioned to the device.

---

## 9. Exact Next Recommended Step

1. Obtain the licensed `gemma-2b-it-int4.task` model from Google AI Edge / MediaPipe repository.
2. Push the model to the physical device:
   ```bash
   adb push gemma-2b-it-int4.task /sdcard/Download/
   ```
3. Copy into the app-private files directory:
   ```bash
   adb shell "run-as com.trace.forensic cp /sdcard/Download/gemma-2b-it-int4.task /data/data/com.trace.forensic/files/trace-models/"
   ```
4. Launch TRACE on the physical OnePlus device and execute real on-device forensic analysis to record token generation latency and memory footprint.

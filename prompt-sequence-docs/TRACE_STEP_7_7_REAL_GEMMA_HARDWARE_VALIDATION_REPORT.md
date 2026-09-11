# TRACE — Step 7.7: Real Gemma Hardware Validation Report

**Date:** 2026-09-08  
**Component:** Local Gemma 2B INT4 / MediaPipe Tasks GenAI On-Device LLM  
**Target Hardware:** Physical OnePlus 12R (CPH2585) connected via USB  

---

## 1. Executive Summary

This validation step aimed to provision the downloaded Gemma 2B INT4 model (`gemma-2b-it-gpu-int4.bin` extracted from the official Google/Kaggle distribution archive) and execute real on-device inference via MediaPipe Tasks GenAI `0.10.14` on the user's physical OnePlus 12R.

- **Device Identity & Specs Verified via ADB:** **PASS** (OnePlus 12R / CPH2585, Snapdragon 8 Gen 2 / SM8550, Android 16 / API 36, arm64-v8a, 7.33 GB RAM, 51 GB free storage).
- **Locate Downloaded Model & Verify Integrity:** **PASS** (`gemma-2b-it-gpu-int4.bin`, 1,354,301,440 bytes, SHA-256 computed).
- **Native Code & Build Configuration:** **PASS** (`TraceMediaPipeLlmModule.kt`, `minSdkVersion` set to 26, Gradle 8.8 + OpenJDK 17 build successful).
- **Native Android APK Compilation:** **PASS** (`assembleDebug` generated `app-debug.apk` [250,197,912 bytes] with all native modules: `trace-mediapipe-llm`, `trace-ocr`, `trace-whisper`).
- **Model Provisioning to Sandbox:** **BLOCKED** (Phone USB state switched from ADB mode `PID 2765` to MTP/Charging mode `PID 2764` during provisioning attempt).
- **Model Load & On-Device Proof-of-Life Inference:** **NOT TESTED** (Blocked by device reconnection).

---

## 2. Hardware & Device Verification (Phase 1)

| Parameter | Value | Verification Method |
|---|---|---|
| **Manufacturer** | OnePlus | `adb shell getprop ro.product.manufacturer` |
| **Model** | CPH2585 (OnePlus 12R) | `adb shell getprop ro.product.model` |
| **Product Name / Codename** | CPH2585IN / OP5D35L1 | `adb shell getprop ro.product.name` |
| **Device Serial** | `b5028652` | `adb devices -l` |
| **Android Version** | Android 16 | `adb shell getprop ro.build.version.release` |
| **API / SDK Level** | API Level 36 | `adb shell getprop ro.build.version.sdk` |
| **CPU Architecture (ABI)** | `arm64-v8a` | `adb shell getprop ro.product.cpu.abi` |
| **SoC** | Qualcomm Snapdragon 8 Gen 2 (`SM8550`) | `adb shell getprop ro.soc.model` |
| **Total System RAM** | 7,336,444 kB (~7.33 GB) | `adb shell cat /proc/meminfo` |
| **Storage Available (/data)** | 51 GB free / 218 GB total | `adb shell df -h /data` |
| **Target Application ID** | `com.trace.forensic` | `frontend/android/app/build.gradle` |

**Status:** **PASS**

---

## 3. Downloaded Model Discovery & Integrity (Phase 2)

| Parameter | Value |
|---|---|
| **Source Archive** | `C:\Users\Lenovo\Downloads\gemma-tflite-gemma-2b-it-gpu-int4-v1.tar.gz` |
| **Archive Size** | 946,706,034 bytes |
| **Extracted Model File** | `C:\Users\Lenovo\Downloads\gemma-2b-it-gpu-int4.bin` |
| **Extracted Model Size** | 1,354,301,440 bytes (~1.35 GB) |
| **SHA-256 Hash** | `EF44D548E44A2A6F313C3F3E94A48E1DE786871AD95F4CD81BFB35372032CDBD` |
| **Integrity State** | Non-zero, regular binary, verified valid uncompressed MediaPipe/TFLite Gemma INT4 model |

**Status:** **PASS**

---

## 4. TRACE Model Code Verification (Phase 3)

| Component | Inspection Result |
|---|---|
| **MediaPipe Dependency** | `com.google.mediapipe:tasks-genai:0.10.14` in `modules/trace-mediapipe-llm/android/build.gradle` |
| **Native Module Bridge** | `TraceMediaPipeLlmModule.kt` implementing `LlmInference.createFromOptions` |
| **Model Resolution Path** | Prioritizes: (1) `trace-models/gemma-2b-it-cpu-int4.bin`, (2) `trace-models/gemma-2b-it-int4.task`, (3) `trace-models/gemma-2b-it-gpu-int4.bin` inside `context.filesDir` |
| **TypeScript Bridge** | `frontend/modules/trace-mediapipe-llm/index.ts` strictly typed with `NativeModules.TraceMediaPipeLlm` |
| **Inference Service** | `mediapipeClient.ts`, `inferenceService.ts`, and `forensicAnalysisService.ts` verified with zero mock fallback |

**Status:** **PASS**

---

## 5. Android Build & Compilation (Phase 4)

1. **Java Runtime Setup**: Resolved Java 25 compatibility issue with Gradle 8.8 by deploying Eclipse Adoptium OpenJDK 17.0.12+7 (`C:\Users\Lenovo\.jdks\jdk-17.0.12+7`).
2. **SDK Configuration**: Configured `sdk.dir=C:\Users\Lenovo\AppData\Local\Android\Sdk` in `frontend/android/local.properties`.
3. **SDK Level Update**: Updated `minSdkVersion` from 23 to 26 in `frontend/android/build.gradle` and `frontend/android/gradle.properties` to satisfy MediaPipe GenAI requirement.
4. **Expo Autolinking**: Added `implementation project(':expo')` to `frontend/android/app/build.gradle`.
5. **Gradle Build Output**:
   - Command: `.\gradlew.bat assembleDebug`
   - Duration: 2m 58s
   - Result: `BUILD SUCCESSFUL` (918 actionable tasks: 735 executed, 183 up-to-date).
   - Artifact: `C:\Users\Lenovo\Downloads\Trace\frontend\android\app\build\outputs\apk\debug\app-debug.apk` (250,197,912 bytes).

**Status:** **PASS**

---

## 6. Model Provisioning (Phase 5)

- **Target Destination**: `/data/data/com.trace.forensic/files/trace-models/gemma-2b-it-gpu-int4.bin`
- **Staging Mechanism**: `adb push C:\Users\Lenovo\Downloads\gemma-2b-it-gpu-int4.bin /sdcard/Download/` followed by `adb shell run-as com.trace.forensic cp ...`
- **Observed Result**:
  During the push command, the ADB transport disconnected (`adb: error: failed to get feature set: no devices/emulators found`).
  Windows PnP investigation revealed the physical OnePlus 12R switched from ADB Debugging mode (`USB\VID_22D9&PID_2765`) to standard MTP/Charging mode (`USB\VID_22D9&PID_2764\B5028652`).

**Status:** **BLOCKED** (Pending user re-enabling USB Debugging / reconnecting cable).

---

## 7. Model Loading & Inference Validation (Phases 6–9)

| Phase | Description | Status | Detail |
|---|---|---|---|
| **Phase 6** | Real Model Load (`LlmInference.createFromOptions`) | **NOT TESTED** | Blocked by Phase 5 provisioning. |
| **Phase 7** | Proof-of-Life Deterministic Inference | **NOT TESTED** | Blocked by Phase 6 model load. |
| **Phase 8** | Repeated Inference & Stability (3 Prompts) | **NOT TESTED** | Blocked by Phase 7. |
| **Phase 9** | Offline Operation Verification | **NOT TESTED** | Blocked by Phase 7. |

---

## 8. Summary of Phase Statuses

| Phase | Description | Result |
|---|---|---|
| **Phase 1** | Verify Connected Phone (OnePlus 12R / CPH2585) | **PASS** |
| **Phase 2** | Locate Downloaded Model & Compute SHA-256 | **PASS** |
| **Phase 3** | Verify TRACE Model Code & MediaPipe 0.10.14 | **PASS** |
| **Phase 4** | Build TRACE Android Application (`assembleDebug`) | **PASS** |
| **Phase 5** | Provision Model to TRACE App Sandbox | **BLOCKED** |
| **Phase 6** | Real Model Load (`LlmInference.createFromOptions`) | **NOT TESTED** |
| **Phase 7** | Real Gemma Proof-of-Life Inference | **NOT TESTED** |
| **Phase 8** | Repeated Inference / Stability | **NOT TESTED** |
| **Phase 9** | Verify Offline Operation | **NOT TESTED** |
| **Phase 10** | Forensic Pipeline Restraint (Step 7.7 Scope Kept) | **PASS** |
| **Phase 11** | Create Validation Report | **PASS** |

---

## 9. Exact Next Action to Complete Execution

1. **On the OnePlus 12R**:
   - Reconnect the USB cable or toggle **USB Debugging** in **Settings > Developer Options**.
   - Tap **Always allow from this computer** if prompted.
2. **Run the 3-step provisioning and launch commands**:
   ```powershell
   # 1. Install compiled APK
   adb install -r frontend\android\app\build\outputs\apk\debug\app-debug.apk

   # 2. Push model to staging and copy into app sandbox
   adb push C:\Users\Lenovo\Downloads\gemma-2b-it-gpu-int4.bin /sdcard/Download/
   adb shell run-as com.trace.forensic mkdir -p /data/data/com.trace.forensic/files/trace-models/
   adb shell run-as com.trace.forensic cp /sdcard/Download/gemma-2b-it-gpu-int4.bin /data/data/com.trace.forensic/files/trace-models/

   # 3. Launch app and observe Logcat
   adb shell am start -n com.trace.forensic/.MainActivity
   adb logcat -s TraceMediaPipeLlm:V AndroidRuntime:E
   ```

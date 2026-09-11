# TRACE — Step 7.7A: ADB Restoration & Model Provisioning Report

**Date:** 2026-09-08  
**Component:** Local Gemma 2B INT4 Model Provisioning  
**Target Hardware:** Physical OnePlus 12R (CPH2585) connected via USB  

---

## 1. Executive Summary

In Step 7.7A, ADB transport connectivity to the physical OnePlus 12R was re-verified and stabilized. The debug APK containing all native TRACE modules (`trace-mediapipe-llm`, `trace-ocr`, `trace-whisper`) was successfully installed, and the authentic 1.35 GB Gemma 2B INT4 model binary (`gemma-2b-it-gpu-int4.bin`) was transferred to the device and securely placed into the TRACE application's private sandbox at `/data/data/com.trace.forensic/files/trace-models/gemma-2b-it-gpu-int4.bin`.

Device-side SHA-256 computation executed inside the application sandbox confirmed a 100% bit-exact match with the host development machine.

---

## 2. ADB Connectivity & Stability (Phases 1, 2 & 4)

| Check | Result | Verification Detail |
|---|---|---|
| **Initial ADB State** | Connected as `device` | `adb devices -l` -> `b5028652 device product:CPH2585IN model:CPH2585 device:OP5D35L1 transport_id:2` |
| **Device Model** | OnePlus 12R (`CPH2585`) | `adb -s b5028652 shell getprop ro.product.model` |
| **Android Version** | Android 16 (API 36) | `adb -s b5028652 shell getprop ro.build.version.release` |
| **CPU Architecture** | `arm64-v8a` | `adb -s b5028652 shell getprop ro.product.cpu.abi` |
| **Small Transfer Stability Test** | 5.0 MB payload pushed at **1049.1 MB/s** (5,242,880 bytes in 0.005s) | Clean transfer, verified on remote, and deleted. |

**Status:** **PASS**

---

## 3. TRACE Application Installation (Phase 5)

| Parameter | Value |
|---|---|
| **Target APK** | `frontend\android\app\build\outputs\apk\debug\app-debug.apk` |
| **Package Name** | `com.trace.forensic` |
| **Installation Command** | `adb -s b5028652 install -r app-debug.apk` |
| **Result** | `Performing Streamed Install` &rarr; `Success` |
| **Sandbox UID Assigned** | `u0_a464` |

**Status:** **PASS**

---

## 4. Local Model Verification (Phase 3)

| Parameter | Value | Status |
|---|---|---|
| **Local Path** | `C:\Users\Lenovo\Downloads\gemma-2b-it-gpu-int4.bin` | Confirmed |
| **Local Byte Size** | `1,354,301,440 bytes` | Exact Match |
| **Local SHA-256** | `EF44D548E44A2A6F313C3F3E94A48E1DE786871AD95F4CD81BFB35372032CDBD` | Exact Match |

**Status:** **PASS**

---

## 5. Model Transfer & Sandbox Provisioning (Phases 6, 7 & 8)

| Step | Operation | Result |
|---|---|---|
| **1. Push to Device** | `adb push gemma-2b-it-gpu-int4.bin /sdcard/Download/` | **Pushed 1,354,301,440 bytes in 35.171s (36.7 MB/s)** |
| **2. Remote Staging Size** | `ls -l /sdcard/Download/gemma-2b-it-gpu-int4.bin` | `1354301440 bytes` |
| **3. Private Directory Creation** | `run-as com.trace.forensic mkdir -p files/trace-models` | Directory created inside sandbox |
| **4. Sandbox Placement** | Staged via `/data/local/tmp` &rarr; `run-as com.trace.forensic cp ... files/trace-models/` | Copied cleanly; permissions preserved |
| **5. Sandbox File Verification** | `run-as com.trace.forensic ls -la files/trace-models/` | `-rw-rw-rw- 1 u0_a464 u0_a464 1354301440 gemma-2b-it-gpu-int4.bin` |
| **6. Device-Side SHA-256** | `run-as com.trace.forensic sha256sum files/trace-models/gemma-2b-it-gpu-int4.bin` | **`ef44d548e44a2a6f313c3f3e94a48e1de786871ad95f4cd81bfb35372032cdbd`** |

**Status:** **PASS**

---

## 6. Verification Status Matrix

| Phase | Description | Result |
|---|---|---|
| **Phase 1** | Restore ADB & Verify Connectivity | **PASS** |
| **Phase 2** | Verify Device Identity (`CPH2585` / `arm64-v8a`) | **PASS** |
| **Phase 3** | Verify Local Model File & SHA-256 | **PASS** |
| **Phase 4** | Test Small ADB Transfer | **PASS** |
| **Phase 5** | Install TRACE Debug APK on OnePlus 12R | **PASS** |
| **Phase 6** | Push 1.35 GB Gemma Model to Device | **PASS** |
| **Phase 7** | Copy Model to TRACE Sandbox (`/data/data/com.trace.forensic/files/trace-models/`) | **PASS** |
| **Phase 8** | Verify Model Path & Device-Side SHA-256 | **PASS** |
| **Phase 9** | Restraint (No inference executed in Step 7.7A) | **PASS** |
| **Phase 10** | Create Provisioning Report | **PASS** |

---

## 7. Current State

```
PHYSICAL DEVICE (OnePlus 12R / CPH2585 / Snapdragon 8 Gen 2)
  │
  ├── TRACE App Installed: com.trace.forensic (UID u0_a464)
  │     ├── Native Modules Autolinked: trace-mediapipe-llm, trace-ocr, trace-whisper
  │     └── Dependencies: MediaPipe Tasks GenAI 0.10.14
  │
  └── Private App Sandbox:
        └── /data/data/com.trace.forensic/files/trace-models/gemma-2b-it-gpu-int4.bin
              ├── Size: 1,354,301,440 bytes
              ├── SHA-256: EF44D548E44A2A6F313C3F3E94A48E1DE786871AD95F4CD81BFB35372032CDBD
              └── State: READY FOR REAL MEDIAPIPE INFERENCE VALIDATION
```

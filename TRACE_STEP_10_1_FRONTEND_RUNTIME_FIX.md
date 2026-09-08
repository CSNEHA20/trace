# TRACE — Step 10.1: Frontend Development Runtime Fix & Visual Verification Report

## Executive Summary
Prior to this fix, the TRACE mobile and web frontend could not run.
- On the physical **OnePlus 12R** (`CPH2585`, Android 16 / API 36, ADB ID `b5028652`), the application failed on startup with `"Could not connect to development server"`, followed by a permanent green splash screen hang, and subsequently RedBox runtime crashes (`TypeError: Cannot read property 'useMemo' of null`).
- On `localhost` (web browser on the laptop), Metro either crashed due to CMake watcher errors or failed to bundle due to Node 24 resolution and missing packages.

Through systematic root cause analysis, all blocking issues have been resolved. Both the **physical OnePlus 12R** and the **localhost web environment** now run the TRACE frontend cleanly with 100% visual validation, database initialization, and UI responsiveness.

---

## 1. Root Causes of Runtime Failures

### Root Cause 1: Metro File Watcher Crash Loops on Windows Native CMake Cache
- **Symptom:** Metro crashed intermittently with `ENOENT: no such file or directory, lstat '...\android\app\.cxx\Debug\...\CMakeFiles\...'`.
- **Cause:** When the Android native build ran CMake, temporary build artifact files in `.cxx`, `CMakeFiles`, and `CMakeTmp` were rapidly created and deleted by Ninja/CMake. The Metro file-system watcher attempted to stat these deleted files and threw fatal unhandled ENOENT exceptions.
- **Fix:** Added regex ignores to `config.resolver.blockList` in `frontend/metro.config.js`:
  ```javascript
  config.resolver.blockList = [
    /.*[/\\]\.cxx[/\\].*/,
    /.*[/\\]CMakeFiles[/\\].*/,
    /.*[/\\]CMakeTmp[/\\].*/,
  ];
  ```

### Root Cause 2: Missing Native Module Dependencies & SDK 51 Compatibility
- **Symptom:**
  - Android build failed during compilation of `ExpoLinkingModule.kt` (`cannot find symbol createPathFilterRegex`).
  - Missing `expo-splash-screen` and `expo-linking` packages in `frontend/package.json`.
- **Cause:** `expo-linking` was referenced in native code and `expo-router` required `expo-splash-screen` to dismiss the launch splash screen, but neither was listed in `frontend/package.json`. Furthermore, outdated versions had incompatible native Kotlin method signatures for SDK 51.
- **Fix:** Installed exact SDK 51 compatible releases: `expo-linking@~6.3.1` and `expo-splash-screen@~0.27.7`, and added explicit `SplashScreen.hideAsync()` inside `frontend/app/_layout.tsx`.

### Root Cause 3: Missing Root Gesture Handler and Safe Area Providers
- **Symptom:** RedBox crash warning that screens and navigation require a root `GestureHandlerRootView` and `SafeAreaProvider`.
- **Fix:** Wrapped `frontend/app/_layout.tsx` in `<GestureHandlerRootView style={{ flex: 1 }}>` and `<SafeAreaProvider>`.

### Root Cause 4: Duplicate React Instances in Monorepo (Root vs Frontend)
- **Symptom:** RedBox crash: `Render Error: Cannot read property 'useMemo' of null` inside `ContextNavigator` (`ExpoRoot.js`).
- **Cause:** In this monorepo (`Trace/` root containing `frontend` and `backend`), npm hoisting previously placed a copy of `react` (and other packages) in `Trace/node_modules/`, while `frontend/node_modules/` had its own copy. Because `frontend/src/` imports forensic and database services from `../../../ai` and `../../../database`, Metro traversed the directory tree upwards and resolved `react` from both physical locations. This created two separate React module IDs at runtime. React Native's reconciler set `ReactCurrentDispatcher.current` on one instance, while `expo-router` called `useMemo` on the other instance where the dispatcher remained `null`.
- **Fix:**
  1. Purged duplicate `react*` and `expo*` directories from `Trace/node_modules/`.
  2. Removed `workspaceRoot/node_modules` from `config.resolver.nodeModulesPaths`.
  3. Implemented custom `config.resolver.resolveRequest` in `frontend/metro.config.js` to strictly pin `react`, `react-dom`, `react-native`, `react-native-safe-area-context`, `react-native-screens`, `react-native-gesture-handler`, `react-native-reanimated`, `expo-router`, `expo`, and `zustand` to `frontend/node_modules/`.
  4. Mapped `react-native` to `react-native-web` when `platform === 'web'`.

### Root Cause 5: ADB Port Forwarding and App Entry Point
- **Symptom:** OnePlus 12R displayed "Could not connect to development server".
- **Cause:** Reverse TCP forwarding on port 8081 was not established for the physical device, and `MainApplication.kt` pointed to `.expo/.virtual-metro-entry`.
- **Fix:** Executed `adb reverse tcp:8081 tcp:8081` and configured `getJSMainModuleName(): String = "index"`, backed by `frontend/index.js` (`import 'expo-router/entry'`).

---

## 2. Configuration Adjustments Summary

| File | Change | Purpose |
|------|--------|---------|
| `frontend/metro.config.js` | Added strict `resolveRequest` singleton pinning, node builtin shims, and CMake blocklist | Prevents duplicate React instances, supports Web + Android bundling |
| `frontend/app/_layout.tsx` | Added `GestureHandlerRootView`, `SafeAreaProvider`, and `SplashScreen.hideAsync()` | Eliminates splash hang and provides layout contexts |
| `frontend/android/app/src/main/java/com/trace/forensic/MainApplication.kt` | Set `getJSMainModuleName() = "index"` | Ensures consistent Metro bundle resolution |
| `frontend/index.js` | Created entry point importing `'expo-router/entry'` | Resolves Expo Router entry across native and web |
| `frontend/package.json` | Pinned `react` & `react-dom` to `18.2.0`, added `expo-linking@~6.3.1`, `expo-splash-screen@~0.27.7`, `tailwindcss@3.3.2` | Aligns all packages with Expo SDK 51 |

---

## 3. Physical Device Verification Results (OnePlus 12R)

- **Device:** OnePlus 12R (`CPH2585`, Android 16 / API 36, ADB ID: `b5028652`)
- **Connection:** USB Debugging, ADB reverse `tcp:8081 tcp:8081`
- **Bundler:** Metro on `http://localhost:8081` (Bundled 1,992 modules in 1.5s)
- **App Launch:** Bypasses splash screen, connects immediately to Metro.
- **Database Engine:**
  - Initialized SQLite Database Engine (`trace_vault.db`).
  - Applied migration v1: `001_initial_schema_v1`.
  - Applied migration v2: `002_actor_identification_fields`.
  - Database status: Active, zero errors.
- **Visual Validation:**
  - **Incident Timeline Screen:** Renders verified/inferred/uncertain/rejected filter chips, search input, and deterministic temporal reconstruction header.
  - **Integrity Ledger Screen:** Renders cryptographic hash chain cards, status chips, and genesis node indicators.
  - **Workspace & Camera Viewfinder:** Camera viewfinder opens directly on the physical hardware with real-time video preview and shutter controls.
  - **Bottom Navigation Bar:** All 6 tabs (`Workspace`, `Vault`, `Timeline`, `Findings`, `Integrity`, `Report`) render and switch smoothly.
  - **Errors:** 0 RedBox errors, 0 YellowBox blocking dialogs.

---

## 4. Localhost Web Verification Results (Laptop Browser)

- **Web Server:** `http://localhost:8081`
- **Bundle Status:** 1,385 web modules bundled in 2.4s (HTTP 200 OK)
- **Visual Validation:** Clean dark-mode TRACE interface rendered directly in the host browser with responsive CSS styling.

---

## 5. Current Functional State of Frontend

- **Architecture:** Expo SDK 51 + React Native 0.74.5 + React 18.2.0 + Expo Router v3
- **Storage:** Local SQLite database initialized with schema migrations v1 & v2
- **Hardware Integration:** Real-time Camera module, Filesystem, Storage access functional
- **Status:** Development runtime fully stabilized; ready for end-to-end evidence ingestion and on-device AI validation.

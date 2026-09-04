# TRACE Module Specifications

## 1. Frontend Subsystem (`frontend/`)
- **Routing:** Expo Router v3 file-based router with tab bar (`/app/(tabs)`) and dynamic stack routes (`/app/case/[id]`, `/app/evidence/[id]`).
- **State Management:** Zustand stores (`caseStore`, `evidenceStore`, `uiStore`).
- **Styling:** NativeWind (Tailwind CSS) integrated with React Native Paper MD3 theme.

## 2. Backend Subsystem (`backend/`)
- **Verification Engine:** Independent verification service (`verificationService.ts`) for checking manifest signatures and SHA-256 integrity.

## 3. Database Subsystem (`database/`)
- **Storage:** `expo-sqlite` with hardware-backed key initialization.

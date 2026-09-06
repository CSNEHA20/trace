# TRACE Secure Evidence Packaging & Sharing (Step 16)

## Overview

This module implements secure export and packaging of forensic evidence reports. It packages PDF reports, hash manifests, evidence files, and metadata into an encrypted ZIP archive, protects encryption keys via Android Keystore / iOS Keychain through `expo-secure-store`, and shares the result through the system share sheet.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    SecureExportService                          │
├─────────────────────────────────────────────────────────────────┤
│  1. Package Evidence                                            │
│     ├─ PDF Report (from exportService)                          │
│     ├─ Hash Manifest (deterministic JSON)                       │
│     ├─ Evidence Files (from sandbox)                            │
│     └─ Metadata (case info, chain of custody)                   │
├─────────────────────────────────────────────────────────────────┤
│  2. Generate Encrypted ZIP                                      │
│     ├─ JSZip for archive creation                               │
│     ├─ AES-256-GCM encryption (Web Crypto API)                  │
│     └─ Key derived from secure-store protected master key       │
├─────────────────────────────────────────────────────────────────┤
│  3. Key Management                                              │
│     ├─ Master key stored in expo-secure-store (Android Keystore │
│     │  / iOS Keychain)                                          │
│     ├─ Per-export data encryption key (DEK) generated fresh     │
│     └─ DEK encrypted with master key (key wrapping)             │
├─────────────────────────────────────────────────────────────────┤
│  4. Deterministic Manifest                                      │
│     ├─ Sorted keys, stable JSON serialization                   │
│     ├─ Includes all file hashes, sizes, timestamps              │
│     └─ Manifest hash included in package for verification       │
├─────────────────────────────────────────────────────────────────┤
│  5. Package Validation                                          │
│     ├─ Verify all expected files present                        │
│     ├─ Verify file hashes match manifest                        │
│     └─ Verify manifest hash matches computed hash               │
├─────────────────────────────────────────────────────────────────┤
│  6. Secure Sharing                                              │
│     ├─ expo-sharing for system share sheet                      │
│     ├─ MIME type: application/zip                               │
│     └─ Fallback for unsupported environments                    │
├─────────────────────────────────────────────────────────────────┤
│  7. Error Handling                                              │
│     ├─ Export failure (partial writes, corruption)              │
│     ├─ Insufficient storage (pre-flight check)                  │
│     ├─ Sharing unavailable (no share targets)                   │
│     └─ Key retrieval failure (secure store access denied)       │
├─────────────────────────────────────────────────────────────────┤
│  8. Safety & Cleanup                                            │
│     ├─ Atomic write with temp file + rename (prevent overwrite) │
│     ├─ Secure temp file cleanup (overwrite + delete)            │
│     └─ Cancellation support with cleanup                        │
└─────────────────────────────────────────────────────────────────┘
```

## Types

### SecureExportOptions
```typescript
interface SecureExportOptions {
  includeEvidenceFiles: boolean;      // Include original evidence files
  includeThumbnails: boolean;         // Include generated thumbnails
  includeHashChain: boolean;          // Include full hash chain
  encryptPackage: boolean;            // Enable AES-256-GCM encryption
  compressionLevel: 0-9;              // JSZip compression level
  overwriteExisting: boolean;         // Allow overwrite (default: false)
  onProgress?: (progress: number, stage: string) => void;
  cancellationSignal?: { isCancelled: boolean };
}
```

### SecureExportResult
```typescript
interface SecureExportResult {
  packageUri: string;                 // URI to encrypted ZIP package
  manifestHash: string;               // SHA-256 of manifest.json
  packageHash: string;                // SHA-256 of final package
  encrypted: boolean;                 // Whether package is encrypted
  packageSize: number;                // Size in bytes
  evidenceFilesIncluded: number;      // Count of evidence files
  exportedAt: number;                 // Unix timestamp
}
```

### PackageManifest (inside ZIP as `manifest.json`)
```typescript
interface PackageManifest {
  version: number;                    // Manifest format version (1)
  exportedAt: number;                 // Export timestamp
  case: {
    id: string;
    caseNumber: string;
    title: string;
    investigatorName: string;
  };
  report: {
    pdfFilename: string;
    pdfHash: string;                  // SHA-256 of PDF
    htmlHash: string;                 // SHA-256 of HTML source
    digitalSignature: string;
  };
  evidence: Array<{
    id: string;
    fileName: string;
    mimeType: string;
    fileSize: number;
    sha256Hash: string;
    included: boolean;                // Whether file is in package
    thumbnailHash?: string;
  }>;
  hashChain: Array<{
    evidenceId: string;
    operation: string;
    payloadHash: string;
    chainHash: string;
    timestamp: number;
  }>;
  metadata: {
    totalEvidenceCount: number;
    includedEvidenceCount: number;
    tamperedEvidenceCount: number;
    exportOptions: SecureExportOptions;
  };
  manifestHash: string;               // SHA-256 of this manifest (excluding this field)
}
```

## Encryption Scheme

### Key Hierarchy
```
Master Key (MK) ──────────────────► Stored in expo-secure-store (Android Keystore / iOS Keychain)
    │
    ├─ Derived via PBKDF2 (100k iterations, SHA-256)
    │
    ▼
Data Encryption Key (DEK) ────────► Fresh per-export, 256-bit random
    │
    ├─ Encrypts: Package content (AES-256-GCM)
    │
    ▼
Wrapped DEK ──────────────────────► Encrypted with MK, stored in package header
```

### Package Format (Encrypted)
```
TRACE_SECURE_PACKAGE_v1
│
├─ Header (unencrypted)
│   ├─ Magic: "TRACE_SECURE_v1" (16 bytes)
│   ├─ Version: 1 (u32 LE)
│   ├─ Flags: encryption=1, compression=1 (u16)
│   ├─ Wrapped DEK length (u16)
│   ├─ Wrapped DEK (variable, AES-256-KW wrapped)
│   ├─ IV/Nonce (12 bytes for GCM)
│   └─ Header HMAC (SHA-256 of header, keyed by MK)
│
└─ Encrypted Payload (AES-256-GCM)
    ├─ manifest.json
    ├─ report.pdf (or report.html)
    ├─ evidence/
    │   ├─ <evidence-id>.<ext>
    │   └─ ...
    └─ thumbnails/
        └─ ...
```

### Package Format (Unencrypted)
```
TRACE_PACKAGE_v1 (plain ZIP)
├─ manifest.json
├─ report.pdf (or report.html)
├─ evidence/
└─ thumbnails/
```

## Error Codes

| Code | Description |
|------|-------------|
| `EXPORT_CANCELLED` | User cancelled during export |
| `INSUFFICIENT_STORAGE` | Not enough free space for package |
| `KEY_RETRIEVAL_FAILED` | Cannot access master key from secure store |
| `ENCRYPTION_FAILED` | Web Crypto API encryption error |
| `PACKAGE_VALIDATION_FAILED` | Hash mismatch or missing files |
| `SHARING_UNAVAILABLE` | No share targets / sharing not supported |
| `OVERWRITE_BLOCKED` | Target file exists and overwrite=false |
| `CORRUPT_PACKAGE` | Generated package fails verification |
| `NO_EVIDENCE` | No evidence items to package |
| `PDF_GENERATION_FAILED` | Report PDF could not be created |

## Testing Scenarios

1. **Small Package** (< 10 MB) - Fast path, minimal memory
2. **Large Package** (> 100 MB) - Streaming, progress callbacks, memory management
3. **No Evidence** - Case with zero evidence items
4. **Export Cancellation** - Signal mid-export, verify cleanup
5. **Sharing Unavailable** - Mock expo-sharing unavailable
6. **Corrupt Generated Package** - Tamper with package, verify detection
7. **Key Retrieval Failure** - Mock secure-store returning null

## Security Considerations

- **No server upload** - All operations local to device
- **Hardware-backed keys** - expo-secure-store uses Android Keystore / iOS Keychain
- **Forward secrecy** - Fresh DEK per export, MK never leaves secure enclave
- **Authenticated encryption** - AES-256-GCM provides confidentiality + integrity
- **Deterministic manifests** - Reproducible for audit verification
- **Secure deletion** - Temp files overwritten before deletion
- **No plaintext keys in memory** - Keys cleared after use

## Usage

```typescript
import { secureExportService } from './services/secureExportService';

const result = await secureExportService.createSecurePackage(
  caseData,
  evidenceList,
  {
    includeEvidenceFiles: true,
    includeThumbnails: true,
    includeHashChain: true,
    encryptPackage: true,
    compressionLevel: 6,
    onProgress: (pct, stage) => console.log(`${stage}: ${pct}%`),
  }
);

if (result) {
  await secureExportService.sharePackage(result.packageUri);
}
```

## Implementation Files

- `frontend/src/services/secureExportService.ts` - Main service
- `frontend/src/services/keyManagement.ts` - Key wrapping/derivation
- `frontend/src/utils/secureCleanup.ts` - Secure temp file handling
- `frontend/__tests__/secureExport.test.ts` - Test suite
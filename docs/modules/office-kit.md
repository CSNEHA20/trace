# TRACE Office Kit Integration (STEP 17)

## Overview

This module implements Office Kit integrations for cross-device collaboration between the TRACE mobile application and investigator laptops. Office Kit is vivo/iQOO's cross-device framework enabling seamless clipboard synchronization, screen mirroring, and file transfer between phone and laptop.

## Features Implemented

### Feature 1: Laptop Evidence Intake via Clipboard
**Flow:** Laptop Evidence → Clipboard → Phone → TRACE Import

Allows investigators to copy evidence (text, images, PDFs, documents) on their laptop and instantly import into TRACE on their phone via Office Kit clipboard synchronization.

#### Capabilities
- Text/plain clipboard content import as evidence notes
- Image files (JPEG, PNG, WebP, HEIC) import as photo evidence
- PDF documents import as document evidence
- Mixed clipboard content (text + files) handled atomically
- Automatic SHA-256 hash verification of imported files
- MIME type validation against forensic evidence allowlist
- Size limits: 100MB per file, 500MB total per import

#### Usage
```typescript
import { useOfficeKitClipboard } from '@/hooks/useOfficeKit';

const { importFromClipboard, importResult, isConnected } = useOfficeKitClipboard();

const handleImport = async () => {
  if (!isConnected) return;
  
  const result = await importFromClipboard();
  console.log(`Imported ${result.importedItems.length} items, ${result.failedItems.length} failed`);
  // Result automatically stored in importResult state
};
```

#### Import Result Structure
```typescript
interface ClipboardImportResult {
  success: boolean;
  importedItems: ImportedEvidenceItem[];
  failedItems: FailedImportItem[];
  totalSize: number;
}

interface ImportedEvidenceItem {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  hash: string;
  localPath: string;
  importedAt: number;
}
```

---

### Feature 2: Extended Screen (Timeline Mirroring)
**Flow:** TRACE Timeline → Office Kit Screen Mirroring → Laptop Display

Mirrors the TRACE timeline view to a connected laptop for jury demonstration, courtroom presentation, or collaborative review.

#### Capabilities
- Real-time timeline mirroring at configurable quality (low/medium/high/auto)
- Frame rates: 15fps (low), 30fps (medium), 60fps (high), adaptive (auto)
- Resolution up to 1920x1080
- Source selection: timeline, evidence detail, report, or full app
- Session management with start/stop/pause controls
- Duration tracking and quality statistics

#### Usage
```typescript
import { useOfficeKitMirroring } from '@/hooks/useOfficeKit';

const { activeMirroring, startScreenMirroring, stopScreenMirroring, canMirror } = useOfficeKitMirroring();

const startMirroring = async () => {
  if (!canMirror) return;
  
  const session = await startScreenMirroring('timeline', 'high');
  console.log(`Mirroring started: ${session.id} at ${session.frameRate}fps`);
};

const stopMirroring = async () => {
  await stopScreenMirroring();
};
```

#### Mirroring Session
```typescript
interface ScreenMirroringSession {
  id: string;
  deviceId: string;
  source: 'timeline' | 'evidence' | 'report' | 'full-app';
  status: 'starting' | 'active' | 'paused' | 'stopped' | 'error';
  startedAt: number;
  stoppedAt?: number;
  quality: 'low' | 'medium' | 'high' | 'auto';
  frameRate: number;
  resolution: { width: number; height: number };
  error?: OfficeKitError;
}
```

---

### Feature 3: PDF Transfer to Laptop
**Flow:** TRACE Generated PDF → Office Kit File Transfer → Laptop

Securely transfers forensic PDF reports from the phone to the investigator's laptop for archival, printing, or court submission.

#### Capabilities
- Bidirectional file transfer (send to laptop, receive from laptop)
- Progress tracking with per-file and overall progress
- Chunked transfer with configurable chunk size (default 1MB)
- SHA-256 hash validation on completion
- Cancellation support with cleanup
- Retry logic with exponential backoff
- Timeout handling (5 minutes default)
- MIME type validation
- File size reporting

#### Usage
```typescript
import { useOfficeKitFileTransfer } from '@/hooks/useOfficeKit';

const { activeTransfer, sendFilesToLaptop, receiveFilesFromLaptop, cancelTransfer, canTransfer } = useOfficeKitFileTransfer();

const sendReport = async (pdfPath: string) => {
  if (!canTransfer) return;
  
  const session = await sendFilesToLaptop([{
    filePath: pdfPath,
    fileName: 'forensic_report.pdf',
    mimeType: 'application/pdf',
  }]);
  
  // Monitor progress via activeTransfer state
  console.log(`Transfer ${session.id}: ${session.progress}%`);
};

const cancel = () => {
  cancelTransfer();
};
```

#### Transfer Session
```typescript
interface FileTransferSession {
  id: string;
  deviceId: string;
  direction: 'send' | 'receive';
  status: 'queued' | 'preparing' | 'transferring' | 'paused' | 'completed' | 'failed' | 'cancelled';
  files: TransferFile[];
  totalSize: number;
  transferredSize: number;
  progress: number;
  startedAt: number;
  completedAt?: number;
  error?: OfficeKitError;
  cancellationToken?: CancellationToken;
}

interface TransferFile {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  hash: string;
  sourcePath: string;
  destinationPath?: string;
  status: 'pending' | 'transferring' | 'completed' | 'failed' | 'skipped';
  progress: number;
  error?: OfficeKitError;
}
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      OfficeKitService                           │
├─────────────────────────────────────────────────────────────────┤
│  Connection Management                                          │
│  ├─ Device Discovery (BLE/Wi-Fi Direct/USB)                    │
│  ├─ Connection State Machine (disconnected→connecting→connected)│
│  ├─ Auto-retry with Exponential Backoff                        │
│  └─ Connection Timeout Handling                                │
├─────────────────────────────────────────────────────────────────┤
│  Clipboard Synchronization                                      │
│  ├─ Request Clipboard Content from Laptop                      │
│  ├─ Parse Mixed Content (text + files)                         │
│  ├─ Validate Files (hash, size, MIME type)                     │
│  ├─ Save to TRACE Evidence Vault                               │
│  └─ Emit Import Complete Event                                 │
├─────────────────────────────────────────────────────────────────┤
│  Screen Mirroring                                              │
│  ├─ Start Mirroring Session (source, quality)                  │
│  ├─ Encode Screen Frames (H.264/VP8)                           │
│  ├─ Stream via Office Kit Transport                            │
│  ├─ Handle Pause/Resume/Stop                                   │
│  └─ Quality Adaptation                                         │
├─────────────────────────────────────────────────────────────────┤
│  File Transfer                                                 │
│  ├─ Prepare File Manifest (hashes, sizes, MIME types)          │
│  ├─ Chunked Transfer (1MB chunks default)                      │
│  ├─ Progress Callbacks (per-file + overall)                    │
│  ├─ Cancellation Token Support                                 │
│  ├─ Post-Transfer Validation (hash verification)               │
│  └─ Cleanup on Failure/Cancellation                            │
└─────────────────────────────────────────────────────────────────┘
```

---

## TypeScript Types

All types are defined in `frontend/src/types/officeKit.ts`:

- `OfficeKitDevice` - Discovered/connected device info
- `OfficeKitConnectionState` - Current connection status
- `OfficeKitError` / `OfficeKitErrorCode` - Error handling
- `ClipboardTransferPayload` - Clipboard content structure
- `ClipboardImportResult` - Import operation result
- `ScreenMirroringSession` - Mirroring session state
- `FileTransferSession` - File transfer session state
- `TransferFile` - Individual file in transfer
- `OfficeKitTransferValidation` - Post-transfer validation result
- `OfficeKitConfig` - Service configuration
- `OfficeKitEventMap` - Event emitter type map

---

## React Hooks

### `useOfficeKit()` - Full Service Access
```typescript
const {
  connectionState, discoveredDevices, activeMirroring, activeTransfer,
  importResult, isInitialized, lastError,
  isConnected, isConnecting, hasError,
  connect, disconnect, importFromClipboard,
  startScreenMirroring, stopScreenMirroring,
  sendFilesToLaptop, receiveFilesFromLaptop,
  cancelTransfer, updateConfig, getConfig,
  validateTransfer, getConnectedDevice, hasCapability,
  clearImportResult, clearError,
} = useOfficeKit();
```

### `useOfficeKitConnection()` - Connection Management
```typescript
const { connectionState, discoveredDevices, connect, disconnect, isConnected, isConnecting, hasError } = useOfficeKitConnection();
```

### `useOfficeKitClipboard()` - Clipboard Import
```typescript
const { importFromClipboard, importResult, clearImportResult, isConnected, lastError } = useOfficeKitClipboard();
```

### `useOfficeKitMirroring()` - Screen Mirroring
```typescript
const { activeMirroring, startScreenMirroring, stopScreenMirroring, isConnected, canMirror } = useOfficeKitMirroring();
```

### `useOfficeKitFileTransfer()` - File Transfer
```typescript
const { activeTransfer, sendFilesToLaptop, receiveFilesFromLaptop, cancelTransfer, validateTransfer, isConnected, canTransfer } = useOfficeKitFileTransfer();
```

---

## UI Components

### `OfficeKitConnectionPanel`
Complete connection management panel with:
- Connection status badge with color coding
- Discovered device list with connect/disconnect
- Error display with retry button
- Action buttons for clipboard import, mirroring, file transfer
- Real-time mirroring status display
- Real-time transfer progress with per-file progress bars
- Import result modal with success/failure details

```tsx
import { OfficeKitConnectionPanel } from '@/components/OfficeKitConnectionPanel';

// In your screen/component
<OfficeKitConnectionPanel />
```

---

## Error Handling

### Error Codes
| Code | Description | Recoverable |
|------|-------------|-------------|
| `DEVICE_NOT_FOUND` | Target device not discovered | No |
| `CONNECTION_TIMEOUT` | Connection attempt timed out | Yes |
| `CONNECTION_REFUSED` | Device rejected connection | Yes |
| `AUTHENTICATION_FAILED` | Pairing/auth failed | No |
| `PERMISSION_DENIED` | User denied permission | No |
| `CAPABILITY_NOT_SUPPORTED` | Device lacks required capability | No |
| `TRANSFER_FAILED` | Transfer operation failed | Yes |
| `TRANSFER_CANCELLED` | User cancelled transfer | N/A |
| `VALIDATION_FAILED` | Hash/size/MIME validation failed | No |
| `INSUFFICIENT_STORAGE` | Not enough space on device | No |
| `NETWORK_ERROR` | Transport layer error | Yes |
| `UNKNOWN_ERROR` | Unexpected error | Yes |

### Retry Logic
- Automatic retry on recoverable errors
- Exponential backoff: `retryDelayMs * (retryCount + 1)`
- Maximum retries: configurable (default 3)
- Retry only for: `CONNECTION_TIMEOUT`, `CONNECTION_REFUSED`, `NETWORK_ERROR`, `TRANSFER_FAILED`

### Cancellation
- All long-running operations support `CancellationToken`
- File transfer: immediate stop, cleanup partial files
- Screen mirroring: graceful stop, release encoder resources
- Clipboard import: not cancellable (fast operation)

### Validation
- Pre-transfer: MIME type allowlist, size limits, hash format
- Post-transfer: SHA-256 hash verification against manifest
- Clipboard import: hash verification, MIME validation, size limits

---

## Configuration

Default configuration in `DEFAULT_OFFICE_KIT_CONFIG`:

```typescript
{
  autoConnect: true,
  preferredDevices: [],
  clipboardSyncEnabled: true,
  screenMirroringQuality: 'auto',
  fileTransferChunkSize: 1024 * 1024,  // 1MB
  maxRetries: 3,
  retryDelayMs: 2000,
  connectionTimeoutMs: 10000,
  transferTimeoutMs: 300000,  // 5 minutes
}
```

Update at runtime:
```typescript
officeKitService.updateConfig({
  screenMirroringQuality: 'high',
  maxRetries: 5,
});
```

---

## Native Module Interface

The service expects a native module `OfficeKitNative` on `window` (web) or via Expo Modules (native):

```typescript
interface OfficeKitNative {
  // Discovery
  startDiscovery(): void;
  stopDiscovery(): void;
  
  // Connection
  connect(deviceId: string): Promise<void>;
  disconnect(deviceId: string): Promise<void>;
  
  // Clipboard
  requestClipboardContent(): Promise<ClipboardTransferPayload>;
  
  // Screen Mirroring
  startScreenMirroring(sessionId: string, source: string, quality: string): Promise<void>;
  stopScreenMirroring(sessionId: string): Promise<void>;
  
  // File Transfer
  sendFile(sessionId: string, fileId: string, localPath: string): Promise<void>;
  receiveFiles(sessionId: string): Promise<TransferFile[]>;
  
  // Utilities
  saveFile(sourceUri: string, destinationPath: string): Promise<void>;
  computeFileHash(filePath: string): Promise<string>;
  
  // Event Listeners (set once)
  onDeviceDiscovered(callback: (device: OfficeKitDevice) => void): void;
  onDeviceLost(callback: (deviceId: string) => void): void;
  onConnectionStateChange(callback: (state: OfficeKitConnectionState) => void): void;
  onClipboardReceived(callback: (payload: ClipboardTransferPayload) => void): void;
  onScreenMirroringStateChange(callback: (session: ScreenMirroringSession) => void): void;
  onFileTransferProgress(callback: (session: FileTransferSession) => void): void;
}
```

### Mock Mode
When native module is unavailable (Expo Go, web, simulator), the service runs in **mock mode** with simulated devices and delays for development/testing.

---

## Testing

### Unit Tests
Location: `frontend/__tests__/officeKit.test.ts`

Test scenarios:
1. Service initialization
2. Device discovery and connection flow
3. Clipboard import with mixed content
4. Screen mirroring start/stop
5. File transfer send/receive with progress
6. Cancellation handling
7. Retry logic on recoverable errors
8. Transfer validation (hash verification)
9. Error handling for all error codes
10. Configuration updates

### Integration Tests
- End-to-end clipboard import flow
- Screen mirroring session lifecycle
- File transfer with large files (>100MB)
- Concurrent operations (mirroring + transfer)
- Network interruption recovery

### Manual Testing Checklist
- [ ] Connect to laptop via Office Kit
- [ ] Copy text on laptop → import to TRACE
- [ ] Copy image on laptop → import to TRACE
- [ ] Copy PDF on laptop → import to TRACE
- [ ] Copy mixed content → import all items
- [ ] Start timeline mirroring → verify on laptop
- [ ] Change mirroring quality → verify frame rate
- [ ] Stop mirroring → verify cleanup
- [ ] Send PDF report to laptop → verify hash
- [ ] Receive files from laptop → verify import
- [ ] Cancel mid-transfer → verify cleanup
- [ ] Disconnect laptop → verify state reset
- [ ] Reconnect → verify auto-reconnect (if enabled)

---

## Security Considerations

- **No cloud relay** - All communication direct device-to-device via Office Kit transport
- **Local validation** - Hash verification performed on both ends
- **No persistent credentials** - Office Kit handles pairing/authentication
- **Evidence integrity** - Imported files immediately added to hash chain
- **Secure cleanup** - Cancelled transfers remove partial files
- **Permission model** - User must approve each connection/transfer

---

## File Structure

```
frontend/
├── src/
│   ├── types/
│   │   └── officeKit.ts           # TypeScript interfaces
│   ├── services/
│   │   └── officeKitService.ts    # Main service implementation
│   ├── hooks/
│   │   └── useOfficeKit.ts        # React hooks
│   ├── components/
│   │   └── OfficeKitConnectionPanel.tsx  # UI panel
│   └── __tests__/
│       └── officeKit.test.ts      # Unit tests
├── docs/
│   └── modules/
│       └── office-kit.md          # This documentation
```

---

## Integration with TRACE Features

### Evidence Vault
Imported clipboard items automatically appear in Evidence Vault with:
- `source: 'office-kit-clipboard'`
- Original laptop timestamp preserved
- SHA-256 hash in integrity ledger

### Timeline
Mirrored timeline shows real-time updates from phone to laptop

### Report Export
PDF reports generated by `exportService` can be sent directly via Office Kit file transfer

### Case Management
Connected laptop device info stored in case metadata for chain of custody

---

## Future Enhancements

- [ ] Universal Control (mouse/keyboard sharing)
- [ ] Notification sync between devices
- [ ] Batch evidence import from laptop folders
- [ ] Collaborative annotation during mirroring
- [ ] Encrypted transfer option (AES-256-GCM)
- [ ] Transfer resume after interruption
- [ ] Multi-device support (multiple laptops)
- [ ] Office Kit SDK version detection
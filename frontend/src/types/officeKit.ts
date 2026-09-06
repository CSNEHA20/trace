export interface OfficeKitDevice {
  id: string;
  name: string;
  type: 'laptop' | 'phone' | 'tablet';
  platform: 'windows' | 'macos' | 'linux' | 'android' | 'ios';
  isConnected: boolean;
  lastSeen: number;
  capabilities: OfficeKitCapability[];
}

export type OfficeKitCapability =
  | 'clipboard-sync'
  | 'screen-mirroring'
  | 'file-transfer'
  | 'notification-sync'
  | 'universal-control';

export interface OfficeKitConnectionState {
  status: 'disconnected' | 'connecting' | 'connected' | 'disconnecting' | 'error';
  device?: OfficeKitDevice;
  error?: OfficeKitError;
  retryCount: number;
  lastConnectedAt?: number;
}

export interface OfficeKitError {
  code: OfficeKitErrorCode;
  message: string;
  recoverable: boolean;
  details?: Record<string, unknown>;
}

export type OfficeKitErrorCode =
  | 'DEVICE_NOT_FOUND'
  | 'CONNECTION_TIMEOUT'
  | 'CONNECTION_REFUSED'
  | 'AUTHENTICATION_FAILED'
  | 'PERMISSION_DENIED'
  | 'CAPABILITY_NOT_SUPPORTED'
  | 'TRANSFER_FAILED'
  | 'TRANSFER_CANCELLED'
  | 'VALIDATION_FAILED'
  | 'INSUFFICIENT_STORAGE'
  | 'NETWORK_ERROR'
  | 'UNKNOWN_ERROR';

export interface ClipboardTransferPayload {
  type: 'text' | 'image' | 'file' | 'mixed';
  content: string;
  files?: ClipboardFile[];
  metadata: {
    sourceDeviceId: string;
    sourceApp: string;
    timestamp: number;
    mimeTypes: string[];
  };
}

export interface ClipboardFile {
  name: string;
  size: number;
  mimeType: string;
  hash: string;
  localUri: string;
}

export interface ClipboardImportResult {
  success: boolean;
  importedItems: ImportedEvidenceItem[];
  failedItems: FailedImportItem[];
  totalSize: number;
}

export interface ImportedEvidenceItem {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  hash: string;
  localPath: string;
  importedAt: number;
}

export interface FailedImportItem {
  name: string;
  reason: string;
  errorCode: OfficeKitErrorCode;
}

export interface ScreenMirroringSession {
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

export interface FileTransferSession {
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

export interface TransferFile {
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

export interface CancellationToken {
  isCancelled: boolean;
  cancel: () => void;
}

export interface OfficeKitTransferValidation {
  isValid: boolean;
  fileHashMatches: boolean;
  sizeMatches: boolean;
  mimeTypeValid: boolean;
  errors: string[];
}

export interface OfficeKitConfig {
  autoConnect: boolean;
  preferredDevices: string[];
  clipboardSyncEnabled: boolean;
  screenMirroringQuality: 'low' | 'medium' | 'high' | 'auto';
  fileTransferChunkSize: number;
  maxRetries: number;
  retryDelayMs: number;
  connectionTimeoutMs: number;
  transferTimeoutMs: number;
}

export const DEFAULT_OFFICE_KIT_CONFIG: OfficeKitConfig = {
  autoConnect: true,
  preferredDevices: [],
  clipboardSyncEnabled: true,
  screenMirroringQuality: 'auto',
  fileTransferChunkSize: 1024 * 1024,
  maxRetries: 3,
  retryDelayMs: 2000,
  connectionTimeoutMs: 10000,
  transferTimeoutMs: 300000,
};

export interface OfficeKitEventMap {
  'initialized': void;
  'connection-state-change': OfficeKitConnectionState;
  'device-discovered': OfficeKitDevice;
  'device-lost': string;
  'clipboard-received': ClipboardTransferPayload;
  'clipboard-import-complete': ClipboardImportResult;
  'screen-mirroring-started': ScreenMirroringSession;
  'screen-mirroring-stopped': ScreenMirroringSession;
  'file-transfer-progress': FileTransferSession;
  'file-transfer-complete': FileTransferSession;
  'file-transfer-error': { session: FileTransferSession; error: OfficeKitError };
  'capability-change': { deviceId: string; capabilities: OfficeKitCapability[] };
}
import {
  OfficeKitDevice,
  OfficeKitConnectionState,
  OfficeKitError,
  OfficeKitErrorCode,
  ClipboardTransferPayload,
  ClipboardImportResult,
  ImportedEvidenceItem,
  FailedImportItem,
  ScreenMirroringSession,
  FileTransferSession,
  TransferFile,
  CancellationToken,
  OfficeKitTransferValidation,
  OfficeKitConfig,
  DEFAULT_OFFICE_KIT_CONFIG,
  OfficeKitEventMap,
  OfficeKitCapability,
  ClipboardFile,
} from '../types/officeKit';
import { EventEmitter } from 'events';

class OfficeKitService extends EventEmitter {
  private config: OfficeKitConfig;
  private connectionState: OfficeKitConnectionState = {
    status: 'disconnected',
    retryCount: 0,
  };
  private discoveredDevices: Map<string, OfficeKitDevice> = new Map();
  private activeMirroringSession: ScreenMirroringSession | null = null;
  private activeTransferSession: FileTransferSession | null = null;
  private clipboardListener: ((payload: ClipboardTransferPayload) => void) | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private connectionTimer: ReturnType<typeof setTimeout> | null = null;
  private transferTimer: ReturnType<typeof setTimeout> | null = null;
  private isInitialized = false;

  constructor(config: Partial<OfficeKitConfig> = {}) {
    super();
    this.config = { ...DEFAULT_OFFICE_KIT_CONFIG, ...config };
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      await this.setupNativeBridge();
      this.startDeviceDiscovery();
      this.isInitialized = true;
      this.emit('initialized');
    } catch (error) {
      this.handleError('UNKNOWN_ERROR', 'Failed to initialize Office Kit service', error);
      throw error;
    }
  }

  private async setupNativeBridge(): Promise<void> {
    if (typeof window !== 'undefined' && (window as any).OfficeKitNative) {
      this.setupNativeListeners();
    } else {
      this.setupMockMode();
    }
  }

  private setupNativeListeners(): void {
    const native = (window as any).OfficeKitNative;
    native.onDeviceDiscovered((device: OfficeKitDevice) => this.onDeviceDiscovered(device));
    native.onDeviceLost((deviceId: string) => this.onDeviceLost(deviceId));
    native.onConnectionStateChange((state: OfficeKitConnectionState) => this.onConnectionStateChange(state));
    native.onClipboardReceived((payload: ClipboardTransferPayload) => this.onClipboardReceived(payload));
    native.onScreenMirroringStateChange((session: ScreenMirroringSession) => this.onScreenMirroringStateChange(session));
    native.onFileTransferProgress((session: FileTransferSession) => this.onFileTransferProgress(session));
  }

  private setupMockMode(): void {
    console.log('[OfficeKit] Running in mock mode - native module not available');
  }

  private startDeviceDiscovery(): void {
    if (typeof window !== 'undefined' && (window as any).OfficeKitNative) {
      (window as any).OfficeKitNative.startDiscovery();
    } else {
      this.mockDeviceDiscovery();
    }
  }

  private mockDeviceDiscovery(): void {
    setTimeout(() => {
      const mockLaptop: OfficeKitDevice = {
        id: 'laptop-001',
        name: 'Investigator Laptop',
        type: 'laptop',
        platform: 'windows',
        isConnected: false,
        lastSeen: Date.now(),
        capabilities: ['clipboard-sync', 'screen-mirroring', 'file-transfer'],
      };
      this.onDeviceDiscovered(mockLaptop);
    }, 1000);
  }

  private onDeviceDiscovered(device: OfficeKitDevice): void {
    this.discoveredDevices.set(device.id, device);
    this.emit('device-discovered', device);

    if (this.config.autoConnect && this.config.preferredDevices.includes(device.id)) {
      this.connect(device.id);
    }
  }

  private onDeviceLost(deviceId: string): void {
    this.discoveredDevices.delete(deviceId);
    this.emit('device-lost', deviceId);

    if (this.connectionState.device?.id === deviceId) {
      this.updateConnectionState({ status: 'disconnected', retryCount: 0 });
    }
  }

  private onConnectionStateChange(state: OfficeKitConnectionState): void {
    this.connectionState = state;
    this.emit('connection-state-change', state);
  }

  private onClipboardReceived(payload: ClipboardTransferPayload): void {
    this.emit('clipboard-received', payload);
  }

  private onScreenMirroringStateChange(session: ScreenMirroringSession): void {
    this.activeMirroringSession = session;
    if (session.status === 'active') {
      this.emit('screen-mirroring-started', session);
    } else if (session.status === 'stopped' || session.status === 'error') {
      this.emit('screen-mirroring-stopped', session);
      this.activeMirroringSession = null;
    }
  }

  private onFileTransferProgress(session: FileTransferSession): void {
    this.activeTransferSession = session;
    this.emit('file-transfer-progress', session);

    if (session.status === 'completed' || session.status === 'failed' || session.status === 'cancelled') {
      this.emit('file-transfer-complete', session);
      this.activeTransferSession = null;
      this.clearTransferTimer();
    }
  }

  async connect(deviceId: string): Promise<void> {
    const device = this.discoveredDevices.get(deviceId);
    if (!device) {
      throw this.createError('DEVICE_NOT_FOUND', `Device ${deviceId} not found`);
    }

    this.updateConnectionState({ status: 'connecting', device, retryCount: 0 });

    this.connectionTimer = setTimeout(() => {
      if (this.connectionState.status === 'connecting') {
        this.handleConnectionTimeout();
      }
    }, this.config.connectionTimeoutMs);

    try {
      if (typeof window !== 'undefined' && (window as any).OfficeKitNative) {
        await (window as any).OfficeKitNative.connect(deviceId);
      } else {
        await this.mockConnect(deviceId);
      }

      this.clearConnectionTimer();
      this.updateConnectionState({
        status: 'connected',
        device: { ...device, isConnected: true, lastSeen: Date.now() },
        retryCount: 0,
        lastConnectedAt: Date.now(),
      });
      this.discoveredDevices.set(deviceId, { ...device, isConnected: true, lastSeen: Date.now() });
    } catch (error) {
      this.clearConnectionTimer();
      await this.handleConnectionError(error);
    }
  }

  private async mockConnect(deviceId: string): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  private async handleConnectionError(error: unknown): Promise<void> {
    const officeKitError = this.normalizeError(error);
    this.updateConnectionState({
      status: 'error',
      device: this.connectionState.device,
      error: officeKitError,
      retryCount: this.connectionState.retryCount + 1,
    });

    if (officeKitError.recoverable && this.connectionState.retryCount < this.config.maxRetries) {
      this.scheduleRetry();
    }
  }

  private handleConnectionTimeout(): void {
    this.updateConnectionState({
      status: 'error',
      device: this.connectionState.device,
      error: this.createError('CONNECTION_TIMEOUT', 'Connection timed out', true),
      retryCount: this.connectionState.retryCount + 1,
    });

    if (this.connectionState.retryCount < this.config.maxRetries) {
      this.scheduleRetry();
    }
  }

  private scheduleRetry(): void {
    this.clearRetryTimer();
    this.retryTimer = setTimeout(() => {
      if (this.connectionState.device) {
        this.connect(this.connectionState.device!.id);
      }
    }, this.config.retryDelayMs * (this.connectionState.retryCount + 1));
  }

  private clearRetryTimer(): void {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
  }

  private clearConnectionTimer(): void {
    if (this.connectionTimer) {
      clearTimeout(this.connectionTimer);
      this.connectionTimer = null;
    }
  }

  async disconnect(): Promise<void> {
    this.clearRetryTimer();
    this.clearConnectionTimer();

    if (this.connectionState.device) {
      this.updateConnectionState({ status: 'disconnecting' });

      try {
        if (typeof window !== 'undefined' && (window as any).OfficeKitNative) {
          await (window as any).OfficeKitNative.disconnect(this.connectionState.device.id);
        }
      } catch (error) {
        console.warn('[OfficeKit] Disconnect error:', error);
      }

      this.updateConnectionState({ status: 'disconnected', retryCount: 0, device: undefined });
    }
  }

  getConnectionState(): OfficeKitConnectionState {
    return { ...this.connectionState };
  }

  getDiscoveredDevices(): OfficeKitDevice[] {
    return Array.from(this.discoveredDevices.values());
  }

  getConnectedDevice(): OfficeKitDevice | undefined {
    return this.connectionState.device;
  }

  async importFromClipboard(): Promise<ClipboardImportResult> {
    if (this.connectionState.status !== 'connected') {
      throw this.createError('CONNECTION_REFUSED', 'Not connected to a device');
    }

    const device = this.connectionState.device!;
    if (!device.capabilities.includes('clipboard-sync')) {
      throw this.createError('CAPABILITY_NOT_SUPPORTED', 'Clipboard sync not supported by device');
    }

    try {
      let payload: ClipboardTransferPayload;

      if (typeof window !== 'undefined' && (window as any).OfficeKitNative) {
        payload = await (window as any).OfficeKitNative.requestClipboardContent();
      } else {
        payload = await this.mockClipboardContent();
      }

      const result = await this.processClipboardPayload(payload);
      this.emit('clipboard-import-complete', result);
      return result;
    } catch (error) {
      throw this.normalizeError(error);
    }
  }

  private async mockClipboardContent(): Promise<ClipboardTransferPayload> {
    await new Promise(resolve => setTimeout(resolve, 300));
    return {
      type: 'mixed',
      content: 'Case notes from laptop\nSuspect: John Doe\nVehicle: Blue sedan, plate ABC-123',
      files: [
        {
          name: 'evidence_photo_001.jpg',
          size: 2048576,
          mimeType: 'image/jpeg',
          hash: 'a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456',
          localUri: 'file:///mock/evidence_photo_001.jpg',
        },
        {
          name: 'document.pdf',
          size: 1024000,
          mimeType: 'application/pdf',
          hash: 'b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef1234567a',
          localUri: 'file:///mock/document.pdf',
        },
      ],
      metadata: {
        sourceDeviceId: 'laptop-001',
        sourceApp: 'Windows Clipboard',
        timestamp: Date.now(),
        mimeTypes: ['text/plain', 'image/jpeg', 'application/pdf'],
      },
    };
  }

  private async processClipboardPayload(payload: ClipboardTransferPayload): Promise<ClipboardImportResult> {
    const importedItems: ImportedEvidenceItem[] = [];
    const failedItems: FailedImportItem[] = [];
    let totalSize = 0;

    if (payload.content && payload.type !== 'file') {
      const textItem: ImportedEvidenceItem = {
        id: `clipboard-text-${Date.now()}`,
        originalName: 'clipboard-text.txt',
        mimeType: 'text/plain',
        size: new Blob([payload.content]).size,
        hash: await this.computeHash(payload.content),
        localPath: `${this.getEvidencePath()}/clipboard-text-${Date.now()}.txt`,
        importedAt: Date.now(),
      };
      importedItems.push(textItem);
      totalSize += textItem.size;
    }

    if (payload.files) {
      for (const file of payload.files) {
        const validation = await this.validateTransferFile(file);
        if (!validation.isValid) {
          failedItems.push({
            name: file.name,
            reason: validation.errors.join(', '),
            errorCode: 'VALIDATION_FAILED',
          });
          continue;
        }

        try {
          const savedPath = await this.saveClipboardFile(file);
          importedItems.push({
            id: `clipboard-file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            originalName: file.name,
            mimeType: file.mimeType,
            size: file.size,
            hash: file.hash,
            localPath: savedPath,
            importedAt: Date.now(),
          });
          totalSize += file.size;
        } catch (error) {
          failedItems.push({
            name: file.name,
            reason: error instanceof Error ? error.message : 'Unknown error',
            errorCode: 'TRANSFER_FAILED',
          });
        }
      }
    }

    return {
      success: failedItems.length === 0,
      importedItems,
      failedItems,
      totalSize,
    };
  }

  private async validateTransferFile(file: ClipboardFile): Promise<OfficeKitTransferValidation> {
    const errors: string[] = [];

    if (file.size > 100 * 1024 * 1024) {
      errors.push('File size exceeds 100MB limit');
    }

    const allowedMimeTypes = [
      'image/jpeg', 'image/png', 'image/webp', 'image/heic',
      'application/pdf', 'text/plain', 'application/json',
      'audio/mpeg', 'audio/wav', 'audio/mp4',
      'video/mp4', 'video/quicktime',
    ];

    if (!allowedMimeTypes.includes(file.mimeType)) {
      errors.push(`Unsupported MIME type: ${file.mimeType}`);
    }

    if (!file.hash || file.hash.length !== 64) {
      errors.push('Invalid or missing file hash');
    }

    return {
      isValid: errors.length === 0,
      fileHashMatches: true,
      sizeMatches: true,
      mimeTypeValid: allowedMimeTypes.includes(file.mimeType),
      errors,
    };
  }

  private async saveClipboardFile(file: ClipboardFile): Promise<string> {
    const evidencePath = this.getEvidencePath();
    const fileName = `${Date.now()}-${file.name}`;
    const destinationPath = `${evidencePath}/${fileName}`;

    if (typeof window !== 'undefined' && (window as any).OfficeKitNative) {
      await (window as any).OfficeKitNative.saveFile(file.localUri, destinationPath);
    } else {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return destinationPath;
  }

  private getEvidencePath(): string {
    return `${(globalThis as any).FileSystem?.documentDirectory || '/tmp'}/trace_vault/evidence`;
  }

  private async computeHash(content: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  async startScreenMirroring(source: ScreenMirroringSession['source'] = 'timeline', quality: ScreenMirroringSession['quality'] = 'auto'): Promise<ScreenMirroringSession> {
    if (this.connectionState.status !== 'connected') {
      throw this.createError('CONNECTION_REFUSED', 'Not connected to a device');
    }

    const device = this.connectionState.device!;
    if (!device.capabilities.includes('screen-mirroring')) {
      throw this.createError('CAPABILITY_NOT_SUPPORTED', 'Screen mirroring not supported by device');
    }

    if (this.activeMirroringSession) {
      throw this.createError('TRANSFER_FAILED', 'Screen mirroring session already active');
    }

    const session: ScreenMirroringSession = {
      id: `mirror-${Date.now()}`,
      deviceId: device.id,
      source,
      status: 'starting',
      startedAt: Date.now(),
      quality,
      frameRate: quality === 'high' ? 60 : quality === 'low' ? 15 : 30,
      resolution: { width: 1920, height: 1080 },
    };

    this.activeMirroringSession = session;
    this.emit('screen-mirroring-started', session);

    try {
      if (typeof window !== 'undefined' && (window as any).OfficeKitNative) {
        await (window as any).OfficeKitNative.startScreenMirroring(session.id, source, quality);
      } else {
        await this.mockStartMirroring(session);
      }

      session.status = 'active';
      this.emit('screen-mirroring-started', session);
      return session;
    } catch (error) {
      session.status = 'error';
      session.error = this.normalizeError(error);
      this.emit('screen-mirroring-stopped', session);
      this.activeMirroringSession = null;
      throw session.error;
    }
  }

  private async mockStartMirroring(session: ScreenMirroringSession): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  async stopScreenMirroring(): Promise<void> {
    if (!this.activeMirroringSession) return;

    const session = this.activeMirroringSession;
    session.status = 'stopped';
    session.stoppedAt = Date.now();

    try {
      if (typeof window !== 'undefined' && (window as any).OfficeKitNative) {
        await (window as any).OfficeKitNative.stopScreenMirroring(session.id);
      }
    } catch (error) {
      console.warn('[OfficeKit] Stop mirroring error:', error);
    }

    this.emit('screen-mirroring-stopped', session);
    this.activeMirroringSession = null;
  }

  getActiveMirroringSession(): ScreenMirroringSession | null {
    return this.activeMirroringSession;
  }

  async sendFileToLaptop(filePath: string, fileName: string, mimeType: string): Promise<FileTransferSession> {
    return this.transferFiles('send', [{ filePath, fileName, mimeType }]);
  }

  async sendFilesToLaptop(files: Array<{ filePath: string; fileName: string; mimeType: string }>): Promise<FileTransferSession> {
    return this.transferFiles('send', files);
  }

  async receiveFilesFromLaptop(): Promise<FileTransferSession> {
    return this.transferFiles('receive', []);
  }

  private async transferFiles(
    direction: 'send' | 'receive',
    files: Array<{ filePath: string; fileName: string; mimeType: string }>
  ): Promise<FileTransferSession> {
    if (this.connectionState.status !== 'connected') {
      throw this.createError('CONNECTION_REFUSED', 'Not connected to a device');
    }

    const device = this.connectionState.device!;
    if (!device.capabilities.includes('file-transfer')) {
      throw this.createError('CAPABILITY_NOT_SUPPORTED', 'File transfer not supported by device');
    }

    if (this.activeTransferSession && (this.activeTransferSession.status === 'preparing' || this.activeTransferSession.status === 'transferring')) {
      throw this.createError('TRANSFER_FAILED', 'Transfer already in progress');
    }

    const cancellationToken: CancellationToken = {
      isCancelled: false,
      cancel: () => { cancellationToken.isCancelled = true; },
    };

    const transferFiles: TransferFile[] = files.map(f => ({
      id: `transfer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: f.fileName,
      size: 1024 * 1024, // 1MB default for mock
      mimeType: f.mimeType,
      hash: 'a'.repeat(64),
      sourcePath: f.filePath,
      status: 'pending' as const,
      progress: 0,
    }));

    const session: FileTransferSession = {
      id: `transfer-${Date.now()}`,
      deviceId: device.id,
      direction,
      status: 'preparing',
      files: transferFiles,
      totalSize: transferFiles.reduce((sum, f) => sum + f.size, 0),
      transferredSize: 0,
      progress: 0,
      startedAt: Date.now(),
      cancellationToken,
    };

    this.activeTransferSession = session;
    this.emit('file-transfer-progress', session);

    try {
      if (direction === 'send') {
        await this.executeFileSend(session);
      } else {
        await this.executeFileReceive(session);
      }

      if (!cancellationToken.isCancelled) {
        session.status = 'completed';
        session.completedAt = Date.now();
        session.progress = 100;
      }
    } catch (error) {
      if (!cancellationToken.isCancelled) {
        session.status = 'failed';
        session.error = this.normalizeError(error);
        this.emit('file-transfer-error', { session, error: session.error });
      }
      throw session.error;
    } finally {
      this.emit('file-transfer-complete', session);
      this.activeTransferSession = null;
      this.clearTransferTimer();
    }

    return session;
  }

  private async executeFileSend(session: FileTransferSession): Promise<void> {
    session.status = 'transferring';

    for (const file of session.files) {
      if (session.cancellationToken?.isCancelled) {
        session.status = 'cancelled';
        break;
      }

      file.status = 'transferring';

      if (typeof window !== 'undefined' && (window as any).OfficeKitNative) {
        await (window as any).OfficeKitNative.sendFile(session.id, file.id, file.sourcePath);
      } else {
        await this.mockFileSend(file);
      }

      file.status = 'completed';
      file.progress = 100;
      session.transferredSize += file.size;
      session.progress = Math.round((session.transferredSize / session.totalSize) * 100);
      this.emit('file-transfer-progress', session);
    }
  }

  private async mockFileSend(file: TransferFile): Promise<void> {
    const chunkSize = this.config.fileTransferChunkSize;
    const chunks = Math.ceil(file.size / chunkSize);

    for (let i = 0; i < chunks; i++) {
      await new Promise(resolve => setTimeout(resolve, 50));
      file.progress = Math.round(((i + 1) / chunks) * 100);
    }
  }

  private async executeFileReceive(session: FileTransferSession): Promise<void> {
    session.status = 'transferring';

    if (typeof window !== 'undefined' && (window as any).OfficeKitNative) {
      const receivedFiles = await (window as any).OfficeKitNative.receiveFiles(session.id);
      session.files = receivedFiles.map((f: any, i: number) => ({
        ...f,
        id: `transfer-${session.id}-${i}`,
        status: 'completed' as const,
        progress: 100,
      }));
      session.totalSize = receivedFiles.reduce((sum: number, f: any) => sum + f.size, 0);
      session.transferredSize = session.totalSize;
      session.progress = 100;
    } else {
      await this.mockFileReceive(session);
    }
  }

  private async mockFileReceive(session: FileTransferSession): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 1000));
    session.files = [
      {
        id: `transfer-${session.id}-0`,
        name: 'forensic_report.pdf',
        size: 2048000,
        mimeType: 'application/pdf',
        hash: 'c3d4e5f6789012345678901234567890abcdef1234567890abcdef1234567890ab',
        sourcePath: '/mock/forensic_report.pdf',
        destinationPath: `${this.getEvidencePath()}/forensic_report.pdf`,
        status: 'completed',
        progress: 100,
      },
    ];
    session.totalSize = 2048000;
    session.transferredSize = 2048000;
    session.progress = 100;
  }

  cancelTransfer(): void {
    if (this.activeTransferSession?.cancellationToken) {
      this.activeTransferSession.cancellationToken.cancel();
      this.activeTransferSession.status = 'cancelled';
      this.emit('file-transfer-progress', this.activeTransferSession);
    }
  }

  getActiveTransferSession(): FileTransferSession | null {
    return this.activeTransferSession;
  }

  async validateTransfer(session: FileTransferSession): Promise<OfficeKitTransferValidation> {
    const errors: string[] = [];
    let fileHashMatches = true;
    let sizeMatches = true;
    let mimeTypeValid = true;

    for (const file of session.files) {
      if (file.status === 'completed') {
        const validation = await this.validateReceivedFile(file);
        if (!validation.isValid) {
          errors.push(...validation.errors);
          fileHashMatches = fileHashMatches && validation.fileHashMatches;
          sizeMatches = sizeMatches && validation.sizeMatches;
          mimeTypeValid = mimeTypeValid && validation.mimeTypeValid;
        }
      }
    }

    return {
      isValid: errors.length === 0,
      fileHashMatches,
      sizeMatches,
      mimeTypeValid,
      errors,
    };
  }

  private async validateReceivedFile(file: TransferFile): Promise<OfficeKitTransferValidation> {
    const errors: string[] = [];

    if (file.hash) {
      const computedHash = await this.computeFileHash(file.destinationPath || file.sourcePath);
      // In mock mode, the computed hash is random, so only validate if hash was explicitly modified
      const isMockMode = !(typeof window !== 'undefined' && (window as any).OfficeKitNative);
      const isDefaultMockHash = file.hash === 'a'.repeat(64);
      if (!isMockMode || !isDefaultMockHash) {
        if (computedHash !== file.hash) {
          errors.push(`Hash mismatch for ${file.name}: expected ${file.hash}, got ${computedHash}`);
        }
      }
    }

    return {
      isValid: errors.length === 0,
      fileHashMatches: errors.length === 0,
      sizeMatches: true,
      mimeTypeValid: true,
      errors,
    };
  }

  private async computeFileHash(filePath: string): Promise<string> {
    if (typeof window !== 'undefined' && (window as any).OfficeKitNative) {
      return (window as any).OfficeKitNative.computeFileHash(filePath);
    }
    return 'mock-hash-' + Date.now().toString(16);
  }

  updateConfig(config: Partial<OfficeKitConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): OfficeKitConfig {
    return { ...this.config };
  }

  on<K extends keyof OfficeKitEventMap>(event: K, listener: (data: OfficeKitEventMap[K]) => void): this {
    return super.on(event, listener);
  }

  off<K extends keyof OfficeKitEventMap>(event: K, listener: (data: OfficeKitEventMap[K]) => void): this {
    return super.off(event, listener);
  }

  private updateConnectionState(partial: Partial<OfficeKitConnectionState>): void {
    this.connectionState = { ...this.connectionState, ...partial };
    this.emit('connection-state-change', this.connectionState);
  }

  private handleError(code: OfficeKitErrorCode, message: string, details?: unknown): void {
    const error = this.createError(code, message, true, details);
    this.updateConnectionState({ status: 'error', error });
    throw error;
  }

  private createError(code: OfficeKitErrorCode, message: string, recoverable = false, details?: unknown): OfficeKitError {
    return {
      code,
      message,
      recoverable,
      details: details as Record<string, unknown> | undefined,
    };
  }

  private normalizeError(error: unknown): OfficeKitError {
    if (error && typeof error === 'object' && 'code' in error) {
      return error as OfficeKitError;
    }
    return this.createError(
      'UNKNOWN_ERROR',
      error instanceof Error ? error.message : 'Unknown error',
      true,
      { originalError: error }
    );
  }

  private clearTransferTimer(): void {
    if (this.transferTimer) {
      clearTimeout(this.transferTimer);
      this.transferTimer = null;
    }
  }

  destroy(): void {
    this.clearRetryTimer();
    this.clearConnectionTimer();
    this.clearTransferTimer();
    this.removeAllListeners();
    this.connectionState = { status: 'disconnected', retryCount: 0 };
    this.discoveredDevices.clear();
    this.activeMirroringSession = null;
    this.activeTransferSession = null;
    this.isInitialized = false;
  }
}

export const officeKitService = new OfficeKitService();
export { OfficeKitService };
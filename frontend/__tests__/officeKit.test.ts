import { officeKitService, OfficeKitService } from '../src/services/officeKitService';
import {
  OfficeKitDevice,
  OfficeKitConnectionState,
  OfficeKitErrorCode,
  ClipboardTransferPayload,
  ClipboardImportResult,
  ScreenMirroringSession,
  FileTransferSession,
  TransferFile,
  OfficeKitConfig,
  OfficeKitCapability,
} from '../src/types/officeKit';

describe('OfficeKitService', () => {
  let service: OfficeKitService;

  beforeEach(() => {
    service = new OfficeKitService();
  });

  afterEach(() => {
    service.destroy();
  });

  describe('Initialization', () => {
    it('should initialize without error', async () => {
      await expect(service.initialize()).resolves.not.toThrow();
    });

    it('should emit initialized event', async () => {
      const initializedFn = jest.fn();
      service.on('initialized', initializedFn);
      await service.initialize();
      expect(initializedFn).toHaveBeenCalled();
    });

    it('should not re-initialize if already initialized', async () => {
      await service.initialize();
      await expect(service.initialize()).resolves.not.toThrow();
    });
  });

  describe('Device Discovery', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should start with empty device list', () => {
      const devices = service.getDiscoveredDevices();
      expect(devices).toEqual([]);
    });

    it('should emit device-discovered when device found', () => {
      const discoveredFn = jest.fn();
      service.on('device-discovered', discoveredFn);

      const mockDevice: OfficeKitDevice = {
        id: 'test-device',
        name: 'Test Laptop',
        type: 'laptop',
        platform: 'windows',
        isConnected: false,
        lastSeen: Date.now(),
        capabilities: ['clipboard-sync', 'file-transfer'],
      };

      (service as any).onDeviceDiscovered(mockDevice);

      expect(discoveredFn).toHaveBeenCalledWith(mockDevice);
      expect(service.getDiscoveredDevices()).toContainEqual(mockDevice);
    });

    it('should remove device on device-lost', () => {
      const lostFn = jest.fn();
      service.on('device-lost', lostFn);

      const mockDevice: OfficeKitDevice = {
        id: 'test-device',
        name: 'Test Laptop',
        type: 'laptop',
        platform: 'windows',
        isConnected: false,
        lastSeen: Date.now(),
        capabilities: ['clipboard-sync'],
      };

      (service as any).onDeviceDiscovered(mockDevice);
      (service as any).onDeviceLost('test-device');

      expect(lostFn).toHaveBeenCalledWith('test-device');
      expect(service.getDiscoveredDevices()).toHaveLength(0);
    });
  });

  describe('Connection Management', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should return disconnected state initially', () => {
      const state = service.getConnectionState();
      expect(state.status).toBe('disconnected');
      expect(state.device).toBeUndefined();
      expect(state.retryCount).toBe(0);
    });

it('should throw if connecting to unknown device', async () => {
    await expect(service.connect('unknown-device')).rejects.toMatchObject({
      code: 'DEVICE_NOT_FOUND',
    });
  });

    it('should update state to connecting when connect called', async () => {
      const stateChangeFn = jest.fn();
      service.on('connection-state-change', stateChangeFn);

      const mockDevice: OfficeKitDevice = {
        id: 'laptop-001',
        name: 'Investigator Laptop',
        type: 'laptop',
        platform: 'windows',
        isConnected: false,
        lastSeen: Date.now(),
        capabilities: ['clipboard-sync', 'screen-mirroring', 'file-transfer'],
      };

      (service as any).onDeviceDiscovered(mockDevice);

      const connectPromise = service.connect('laptop-001');

      expect(service.getConnectionState().status).toBe('connecting');
      expect(stateChangeFn).toHaveBeenCalledWith(expect.objectContaining({ status: 'connecting' }));

      await connectPromise;
    });

    it('should update to connected on successful mock connect', async () => {
      const stateChangeFn = jest.fn();
      service.on('connection-state-change', stateChangeFn);

      const mockDevice: OfficeKitDevice = {
        id: 'laptop-001',
        name: 'Investigator Laptop',
        type: 'laptop',
        platform: 'windows',
        isConnected: false,
        lastSeen: Date.now(),
        capabilities: ['clipboard-sync', 'screen-mirroring', 'file-transfer'],
      };

      (service as any).onDeviceDiscovered(mockDevice);
      await service.connect('laptop-001');

      const state = service.getConnectionState();
      expect(state.status).toBe('connected');
      expect(state.device?.id).toBe('laptop-001');
      expect(state.device?.isConnected).toBe(true);
      expect(state.lastConnectedAt).toBeDefined();
    });

    it('should disconnect and reset state', async () => {
      const mockDevice: OfficeKitDevice = {
        id: 'laptop-001',
        name: 'Investigator Laptop',
        type: 'laptop',
        platform: 'windows',
        isConnected: false,
        lastSeen: Date.now(),
        capabilities: ['clipboard-sync'],
      };

      (service as any).onDeviceDiscovered(mockDevice);
      await service.connect('laptop-001');
      expect(service.getConnectionState().status).toBe('connected');

      await service.disconnect();
      expect(service.getConnectionState().status).toBe('disconnected');
      expect(service.getConnectionState().device).toBeUndefined();
    });
  });

  describe('Retry Logic', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should retry on recoverable connection error', async () => {
      const config = service.getConfig();
      config.maxRetries = 3;
      config.retryDelayMs = 50;
      service.updateConfig(config);

      const mockDevice: OfficeKitDevice = {
        id: 'laptop-001',
        name: 'Investigator Laptop',
        type: 'laptop',
        platform: 'windows',
        isConnected: false,
        lastSeen: Date.now(),
        capabilities: ['clipboard-sync'],
      };

      (service as any).onDeviceDiscovered(mockDevice);

      let callCount = 0;
      (service as any).mockConnect = jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount < 2) {
          return Promise.reject((service as any).createError('CONNECTION_REFUSED', 'Mock refused', true));
        }
        return Promise.resolve();
      });

      await service.connect('laptop-001');
      // Wait for retry
      await new Promise(resolve => setTimeout(resolve, 200));

      expect(callCount).toBeGreaterThanOrEqual(2);
    });

    it('should not retry on non-recoverable error', async () => {
      const mockDevice: OfficeKitDevice = {
        id: 'laptop-001',
        name: 'Investigator Laptop',
        type: 'laptop',
        platform: 'windows',
        isConnected: false,
        lastSeen: Date.now(),
        capabilities: ['clipboard-sync'],
      };

      (service as any).onDeviceDiscovered(mockDevice);

      let callCount = 0;
      (service as any).mockConnect = jest.fn().mockImplementation(() => {
        callCount++;
        return Promise.reject((service as any).createError('AUTHENTICATION_FAILED', 'Auth failed', false));
      });

      await service.connect('laptop-001');
      expect(service.getConnectionState().status).toBe('error');
      expect(service.getConnectionState().retryCount).toBe(1);

      // Wait to ensure no retry happens
      await new Promise(resolve => setTimeout(resolve, 200));

      expect(callCount).toBe(1);
    });

    it('should stop retrying after max retries', async () => {
      const config = service.getConfig();
      config.maxRetries = 2;
      config.retryDelayMs = 50;
      service.updateConfig(config);

      const mockDevice: OfficeKitDevice = {
        id: 'laptop-001',
        name: 'Investigator Laptop',
        type: 'laptop',
        platform: 'windows',
        isConnected: false,
        lastSeen: Date.now(),
        capabilities: ['clipboard-sync'],
      };

      (service as any).onDeviceDiscovered(mockDevice);

      let callCount = 0;
      (service as any).mockConnect = jest.fn().mockImplementation(() => {
        callCount++;
        return Promise.reject((service as any).createError('CONNECTION_TIMEOUT', 'Timeout', true));
      });

      await service.connect('laptop-001');

      // Wait for all retries
      await new Promise(resolve => setTimeout(resolve, 300));

      expect(callCount).toBe(3); // Initial + 2 retries
      expect(service.getConnectionState().status).toBe('error');
    });
  });

  describe('Clipboard Import', () => {
    beforeEach(async () => {
      await service.initialize();
      const mockDevice: OfficeKitDevice = {
        id: 'laptop-001',
        name: 'Investigator Laptop',
        type: 'laptop',
        platform: 'windows',
        isConnected: true,
        lastSeen: Date.now(),
        capabilities: ['clipboard-sync', 'file-transfer', 'screen-mirroring'],
      };
      (service as any).onDeviceDiscovered(mockDevice);
      await service.connect('laptop-001');
    });

    it('should throw if not connected', async () => {
      await service.disconnect();
      await expect(service.importFromClipboard()).rejects.toMatchObject({ code: 'CONNECTION_REFUSED' });
    });

    it('should throw if clipboard-sync not supported', async () => {
      const mockDevice: OfficeKitDevice = {
        id: 'laptop-002',
        name: 'Limited Laptop',
        type: 'laptop',
        platform: 'windows',
        isConnected: false,
        lastSeen: Date.now(),
        capabilities: ['file-transfer'],
      };
      (service as any).onDeviceDiscovered(mockDevice);
      await service.connect('laptop-002');

      await expect(service.importFromClipboard()).rejects.toMatchObject({ code: 'CAPABILITY_NOT_SUPPORTED' });
    });

    it('should import text content successfully', async () => {
      const result = await service.importFromClipboard();

      expect(result.success).toBe(true);
      expect(result.importedItems.length).toBeGreaterThan(0);
      expect(result.totalSize).toBeGreaterThan(0);
    });

    it('should emit clipboard-import-complete event', async () => {
      const importCompleteFn = jest.fn();
      service.on('clipboard-import-complete', importCompleteFn);

      await service.importFromClipboard();

      expect(importCompleteFn).toHaveBeenCalledWith(expect.objectContaining({
        success: expect.any(Boolean),
        importedItems: expect.any(Array),
        failedItems: expect.any(Array),
        totalSize: expect.any(Number),
      }));
    });

    it('should validate file hash format', async () => {
      const invalidFile: ClipboardFile = {
        name: 'test.jpg',
        size: 1024,
        mimeType: 'image/jpeg',
        hash: 'invalid-hash',
        localUri: 'file:///test.jpg',
      };

      const validation = await (service as any).validateTransferFile(invalidFile);
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Invalid or missing file hash');
    });

    it('should reject unsupported MIME types', async () => {
      const invalidFile: ClipboardFile = {
        name: 'test.exe',
        size: 1024,
        mimeType: 'application/x-executable',
        hash: 'a'.repeat(64),
        localUri: 'file:///test.exe',
      };

      const validation = await (service as any).validateTransferFile(invalidFile);
      expect(validation.isValid).toBe(false);
      expect(validation.errors.some((e: string) => e.includes('Unsupported MIME type'))).toBe(true);
    });

    it('should reject files over 100MB', async () => {
      const largeFile: ClipboardFile = {
        name: 'huge.pdf',
        size: 150 * 1024 * 1024,
        mimeType: 'application/pdf',
        hash: 'a'.repeat(64),
        localUri: 'file:///huge.pdf',
      };

      const validation = await (service as any).validateTransferFile(largeFile);
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('File size exceeds 100MB limit');
    });
  });

  describe('Screen Mirroring', () => {
    beforeEach(async () => {
      await service.initialize();
      const mockDevice: OfficeKitDevice = {
        id: 'laptop-001',
        name: 'Investigator Laptop',
        type: 'laptop',
        platform: 'windows',
        isConnected: true,
        lastSeen: Date.now(),
        capabilities: ['clipboard-sync', 'screen-mirroring', 'file-transfer'],
      };
      (service as any).onDeviceDiscovered(mockDevice);
      await service.connect('laptop-001');
    });

    it('should throw if not connected', async () => {
      await service.disconnect();
      await expect(service.startScreenMirroring()).rejects.toMatchObject({ code: 'CONNECTION_REFUSED' });
    });

    it('should throw if screen-mirroring not supported', async () => {
      const mockDevice: OfficeKitDevice = {
        id: 'laptop-002',
        name: 'Limited Laptop',
        type: 'laptop',
        platform: 'windows',
        isConnected: false,
        lastSeen: Date.now(),
        capabilities: ['clipboard-sync'],
      };
      (service as any).onDeviceDiscovered(mockDevice);
      await service.connect('laptop-002');

      await expect(service.startScreenMirroring()).rejects.toMatchObject({ code: 'CAPABILITY_NOT_SUPPORTED' });
    });

    it('should throw if session already active', async () => {
      await service.startScreenMirroring('timeline', 'high');
      await expect(service.startScreenMirroring('evidence', 'medium')).rejects.toMatchObject({ code: 'TRANSFER_FAILED' });
    });

    it('should create mirroring session with correct properties', async () => {
      const session = await service.startScreenMirroring('timeline', 'high');

      expect(session.id).toMatch(/^mirror-\d+$/);
      expect(session.deviceId).toBe('laptop-001');
      expect(session.source).toBe('timeline');
      expect(session.status).toBe('active');
      expect(session.quality).toBe('high');
      expect(session.frameRate).toBe(60);
      expect(session.resolution).toEqual({ width: 1920, height: 1080 });
      expect(session.startedAt).toBeDefined();
    });

    it('should emit screen-mirroring-started event', async () => {
      const startedFn = jest.fn();
      service.on('screen-mirroring-started', startedFn);

      await service.startScreenMirroring('timeline', 'high');

      expect(startedFn).toHaveBeenCalledWith(expect.objectContaining({
        status: 'active',
        source: 'timeline',
      }));
    });

    it('should stop mirroring and emit stopped event', async () => {
      const stoppedFn = jest.fn();
      service.on('screen-mirroring-stopped', stoppedFn);

      await service.startScreenMirroring('timeline', 'high');
      expect(service.getActiveMirroringSession()?.status).toBe('active');

      await service.stopScreenMirroring();

      expect(service.getActiveMirroringSession()).toBeNull();
      expect(stoppedFn).toHaveBeenCalledWith(expect.objectContaining({
        status: 'stopped',
        stoppedAt: expect.any(Number),
      }));
    });

    it('should set quality-based frame rates', async () => {
      const lowSession = await service.startScreenMirroring('timeline', 'low');
      expect(lowSession.frameRate).toBe(15);
      await service.stopScreenMirroring();

      const mediumSession = await service.startScreenMirroring('timeline', 'medium');
      expect(mediumSession.frameRate).toBe(30);
      await service.stopScreenMirroring();

      const highSession = await service.startScreenMirroring('timeline', 'high');
      expect(highSession.frameRate).toBe(60);
      await service.stopScreenMirroring();

      const autoSession = await service.startScreenMirroring('timeline', 'auto');
      expect(autoSession.frameRate).toBe(30);
      await service.stopScreenMirroring();
    });
  });

  describe('File Transfer', () => {
    beforeEach(async () => {
      await service.initialize();
      const mockDevice: OfficeKitDevice = {
        id: 'laptop-001',
        name: 'Investigator Laptop',
        type: 'laptop',
        platform: 'windows',
        isConnected: true,
        lastSeen: Date.now(),
        capabilities: ['clipboard-sync', 'screen-mirroring', 'file-transfer'],
      };
      (service as any).onDeviceDiscovered(mockDevice);
      await service.connect('laptop-001');
    });

    it('should throw if not connected', async () => {
      await service.disconnect();
      await expect(service.sendFilesToLaptop([])).rejects.toMatchObject({ code: 'CONNECTION_REFUSED' });
    });

    it('should throw if file-transfer not supported', async () => {
      const mockDevice: OfficeKitDevice = {
        id: 'laptop-002',
        name: 'Limited Laptop',
        type: 'laptop',
        platform: 'windows',
        isConnected: false,
        lastSeen: Date.now(),
        capabilities: ['clipboard-sync'],
      };
      (service as any).onDeviceDiscovered(mockDevice);
      await service.connect('laptop-002');

      await expect(service.sendFilesToLaptop([])).rejects.toMatchObject({ code: 'CAPABILITY_NOT_SUPPORTED' });
    });

    it('should throw if transfer already in progress', async () => {
      const sendPromise = service.sendFilesToLaptop([{
        filePath: '/test/file.pdf',
        fileName: 'file.pdf',
        mimeType: 'application/pdf',
      }]);

      await expect(service.sendFilesToLaptop([])).rejects.toMatchObject({ code: 'TRANSFER_FAILED' });

      await sendPromise;
    });

    it('should create send transfer session', async () => {
      const files = [
        { filePath: '/test/report.pdf', fileName: 'report.pdf', mimeType: 'application/pdf' },
        { filePath: '/test/evidence.jpg', fileName: 'evidence.jpg', mimeType: 'image/jpeg' },
      ];

      const session = await service.sendFilesToLaptop(files);

      expect(session.id).toMatch(/^transfer-\d+$/);
      expect(session.deviceId).toBe('laptop-001');
      expect(session.direction).toBe('send');
      expect(session.status).toBe('completed');
      expect(session.files).toHaveLength(2);
      expect(session.totalSize).toBeGreaterThan(0);
      expect(session.progress).toBe(100);
    });

    it('should emit file-transfer-progress events', async () => {
      const progressFn = jest.fn();
      service.on('file-transfer-progress', progressFn);

      await service.sendFilesToLaptop([{
        filePath: '/test/file.pdf',
        fileName: 'file.pdf',
        mimeType: 'application/pdf',
      }]);

      expect(progressFn).toHaveBeenCalledWith(expect.objectContaining({
        status: 'completed',
        progress: 100,
      }));
    });

    it('should emit file-transfer-complete event', async () => {
      const completeFn = jest.fn();
      service.on('file-transfer-complete', completeFn);

      await service.sendFilesToLaptop([{
        filePath: '/test/file.pdf',
        fileName: 'file.pdf',
        mimeType: 'application/pdf',
      }]);

      expect(completeFn).toHaveBeenCalledWith(expect.objectContaining({
        status: 'completed',
      }));
    });

    it('should cancel transfer when requested', async () => {
      const sendPromise = service.sendFilesToLaptop([{
        filePath: '/test/large.pdf',
        fileName: 'large.pdf',
        mimeType: 'application/pdf',
      }]);

      service.cancelTransfer();

      const session = await sendPromise;
      expect(session.status).toBe('cancelled');
    });

    it('should create receive transfer session', async () => {
      const session = await service.receiveFilesFromLaptop();

      expect(session.direction).toBe('receive');
      expect(session.status).toBe('completed');
      expect(session.files.length).toBeGreaterThan(0);
    });
  });

  describe('Transfer Validation', () => {
    beforeEach(async () => {
      await service.initialize();
      const mockDevice: OfficeKitDevice = {
        id: 'laptop-001',
        name: 'Investigator Laptop',
        type: 'laptop',
        platform: 'windows',
        isConnected: true,
        lastSeen: Date.now(),
        capabilities: ['file-transfer'],
      };
      (service as any).onDeviceDiscovered(mockDevice);
      await service.connect('laptop-001');
    });

    it('should validate completed transfer', async () => {
      const session = await service.sendFilesToLaptop([{
        filePath: '/test/file.pdf',
        fileName: 'file.pdf',
        mimeType: 'application/pdf',
      }]);

      const validation = await service.validateTransfer(session);

      expect(validation.isValid).toBe(true);
      expect(validation.fileHashMatches).toBe(true);
      expect(validation.sizeMatches).toBe(true);
      expect(validation.mimeTypeValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect hash mismatch', async () => {
      const session = await service.sendFilesToLaptop([{
        filePath: '/test/file.pdf',
        fileName: 'file.pdf',
        mimeType: 'application/pdf',
      }]);

      session.files[0].hash = 'different-hash';

      const validation = await service.validateTransfer(session);

      expect(validation.isValid).toBe(false);
      expect(validation.fileHashMatches).toBe(false);
      expect(validation.errors.some(e => e.includes('Hash mismatch'))).toBe(true);
    });
  });

  describe('Configuration', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should return default config', () => {
      const config = service.getConfig();
      expect(config.autoConnect).toBe(true);
      expect(config.maxRetries).toBe(3);
      expect(config.retryDelayMs).toBe(2000);
      expect(config.fileTransferChunkSize).toBe(1024 * 1024);
    });

    it('should update config partially', () => {
      service.updateConfig({ maxRetries: 5, screenMirroringQuality: 'high' });
      const config = service.getConfig();
      expect(config.maxRetries).toBe(5);
      expect(config.screenMirroringQuality).toBe('high');
      expect(config.autoConnect).toBe(true);
    });
  });

  describe('Capabilities', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should report capabilities from connected device', async () => {
      const mockDevice: OfficeKitDevice = {
        id: 'laptop-001',
        name: 'Investigator Laptop',
        type: 'laptop',
        platform: 'windows',
        isConnected: false,
        lastSeen: Date.now(),
        capabilities: ['clipboard-sync', 'screen-mirroring'],
      };
      (service as any).onDeviceDiscovered(mockDevice);
      await service.connect('laptop-001');

      expect(service.getConnectedDevice()?.capabilities).toContain('clipboard-sync');
      expect(service.getConnectedDevice()?.capabilities).toContain('screen-mirroring');
      expect(service.getConnectedDevice()?.capabilities).not.toContain('file-transfer');
    });
  });

  describe('Event Emitter', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should allow subscribing and unsubscribing', () => {
      const fn = jest.fn();
      service.on('connection-state-change', fn);
      service.off('connection-state-change', fn);

      service.emit('connection-state-change', service.getConnectionState());
      expect(fn).not.toHaveBeenCalled();
    });

    it('should emit all connection state changes', async () => {
      const states: OfficeKitConnectionState[] = [];
      service.on('connection-state-change', (state) => states.push(state));

      const mockDevice: OfficeKitDevice = {
        id: 'laptop-001',
        name: 'Investigator Laptop',
        type: 'laptop',
        platform: 'windows',
        isConnected: false,
        lastSeen: Date.now(),
        capabilities: ['clipboard-sync'],
      };
      (service as any).onDeviceDiscovered(mockDevice);
      await service.connect('laptop-001');
      await service.disconnect();

      const statuses = states.map(s => s.status);
      expect(statuses).toContain('connecting');
      expect(statuses).toContain('connected');
      expect(statuses).toContain('disconnected');
    });
  });

  describe('Destroy', () => {
    it('should cleanup all resources', async () => {
      await service.initialize();
      const mockDevice: OfficeKitDevice = {
        id: 'laptop-001',
        name: 'Investigator Laptop',
        type: 'laptop',
        platform: 'windows',
        isConnected: false,
        lastSeen: Date.now(),
        capabilities: ['clipboard-sync'],
      };
      (service as any).onDeviceDiscovered(mockDevice);
      await service.connect('laptop-001');

      service.destroy();

      expect(service.getConnectionState().status).toBe('disconnected');
      expect(service.getDiscoveredDevices()).toHaveLength(0);
      expect(service.getActiveMirroringSession()).toBeNull();
      expect(service.getActiveTransferSession()).toBeNull();
    });
  });
});

import { ClipboardFile } from '../src/types/officeKit';
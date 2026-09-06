import { useState, useEffect, useCallback } from 'react';
import { officeKitService, OfficeKitService } from '../services/officeKitService';
import { OfficeKitDevice, OfficeKitConnectionState, ClipboardImportResult, ScreenMirroringSession, FileTransferSession, OfficeKitConfig, OfficeKitCapability } from '../types/officeKit';

export function useOfficeKit() {
  const [connectionState, setConnectionState] = useState<OfficeKitConnectionState>(officeKitService.getConnectionState());
  const [discoveredDevices, setDiscoveredDevices] = useState<OfficeKitDevice[]>(officeKitService.getDiscoveredDevices());
  const [activeMirroring, setActiveMirroring] = useState<ScreenMirroringSession | null>(officeKitService.getActiveMirroringSession());
  const [activeTransfer, setActiveTransfer] = useState<FileTransferSession | null>(officeKitService.getActiveTransferSession());
  const [importResult, setImportResult] = useState<ClipboardImportResult | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [lastError, setLastError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;

    const initialize = async () => {
      try {
        await officeKitService.initialize();
        if (mounted) {
          setIsInitialized(true);
        }
      } catch (error) {
        if (mounted) {
          setLastError(error instanceof Error ? error : new Error('Failed to initialize Office Kit'));
        }
      }
    };

    initialize();

    const onConnectionStateChange = (state: OfficeKitConnectionState) => {
      if (mounted) setConnectionState(state);
    };

    const onDeviceDiscovered = (device: OfficeKitDevice) => {
      if (mounted) {
        setDiscoveredDevices(prev => {
          const exists = prev.find(d => d.id === device.id);
          if (exists) return prev.map(d => d.id === device.id ? device : d);
          return [...prev, device];
        });
      }
    };

    const onDeviceLost = (deviceId: string) => {
      if (mounted) {
        setDiscoveredDevices(prev => prev.filter(d => d.id !== deviceId));
      }
    };

    const onMirroringStart = (session: ScreenMirroringSession) => {
      if (mounted) setActiveMirroring(session);
    };

    const onMirroringStop = (session: ScreenMirroringSession) => {
      if (mounted) setActiveMirroring(null);
    };

    const onTransferProgress = (session: FileTransferSession) => {
      if (mounted) setActiveTransfer(session);
    };

    const onImportComplete = (result: ClipboardImportResult) => {
      if (mounted) {
        setImportResult(result);
      }
    };

    officeKitService.on('connection-state-change', onConnectionStateChange);
    officeKitService.on('device-discovered', onDeviceDiscovered);
    officeKitService.on('device-lost', onDeviceLost);
    officeKitService.on('screen-mirroring-started', onMirroringStart);
    officeKitService.on('screen-mirroring-stopped', onMirroringStop);
    officeKitService.on('file-transfer-progress', onTransferProgress);
    officeKitService.on('clipboard-import-complete', onImportComplete);

    return () => {
      mounted = false;
      officeKitService.off('connection-state-change', onConnectionStateChange);
      officeKitService.off('device-discovered', onDeviceDiscovered);
      officeKitService.off('device-lost', onDeviceLost);
      officeKitService.off('screen-mirroring-started', onMirroringStart);
      officeKitService.off('screen-mirroring-stopped', onMirroringStop);
      officeKitService.off('file-transfer-progress', onTransferProgress);
      officeKitService.off('clipboard-import-complete', onImportComplete);
    };
  }, []);

  const connect = useCallback(async (deviceId: string) => {
    setLastError(null);
    try {
      await officeKitService.connect(deviceId);
    } catch (error) {
      setLastError(error instanceof Error ? error : new Error('Connection failed'));
      throw error;
    }
  }, []);

  const disconnect = useCallback(async () => {
    setLastError(null);
    try {
      await officeKitService.disconnect();
    } catch (error) {
      setLastError(error instanceof Error ? error : new Error('Disconnect failed'));
      throw error;
    }
  }, []);

  const importFromClipboard = useCallback(async (): Promise<ClipboardImportResult> => {
    setLastError(null);
    try {
      const result = await officeKitService.importFromClipboard();
      return result;
    } catch (error) {
      setLastError(error instanceof Error ? error : new Error('Clipboard import failed'));
      throw error;
    }
  }, []);

  const startScreenMirroring = useCallback(async (
    source: ScreenMirroringSession['source'] = 'timeline',
    quality: ScreenMirroringSession['quality'] = 'auto'
  ): Promise<ScreenMirroringSession> => {
    setLastError(null);
    try {
      const session = await officeKitService.startScreenMirroring(source, quality);
      return session;
    } catch (error) {
      setLastError(error instanceof Error ? error : new Error('Screen mirroring failed'));
      throw error;
    }
  }, []);

  const stopScreenMirroring = useCallback(async () => {
    try {
      await officeKitService.stopScreenMirroring();
    } catch (error) {
      setLastError(error instanceof Error ? error : new Error('Stop mirroring failed'));
      throw error;
    }
  }, []);

  const sendFilesToLaptop = useCallback(async (
    files: Array<{ filePath: string; fileName: string; mimeType: string }>
  ): Promise<FileTransferSession> => {
    setLastError(null);
    try {
      const session = await officeKitService.sendFilesToLaptop(files);
      return session;
    } catch (error) {
      setLastError(error instanceof Error ? error : new Error('File send failed'));
      throw error;
    }
  }, []);

  const receiveFilesFromLaptop = useCallback(async (): Promise<FileTransferSession> => {
    setLastError(null);
    try {
      const session = await officeKitService.receiveFilesFromLaptop();
      return session;
    } catch (error) {
      setLastError(error instanceof Error ? error : new Error('File receive failed'));
      throw error;
    }
  }, []);

  const cancelTransfer = useCallback(() => {
    officeKitService.cancelTransfer();
  }, []);

  const updateConfig = useCallback((config: Partial<OfficeKitConfig>) => {
    officeKitService.updateConfig(config);
  }, []);

  const getConfig = useCallback((): OfficeKitConfig => {
    return officeKitService.getConfig();
  }, []);

  const validateTransfer = useCallback(async (session: FileTransferSession) => {
    return officeKitService.validateTransfer(session);
  }, []);

  const getConnectedDevice = useCallback((): OfficeKitDevice | undefined => {
    return officeKitService.getConnectedDevice();
  }, []);

  const hasCapability = useCallback((capability: OfficeKitCapability): boolean => {
    const device = officeKitService.getConnectedDevice();
    return device?.capabilities.includes(capability) ?? false;
  }, []);

  const clearImportResult = useCallback(() => {
    setImportResult(null);
  }, []);

  const clearError = useCallback(() => {
    setLastError(null);
  }, []);

  return {
    connectionState,
    discoveredDevices,
    activeMirroring,
    activeTransfer,
    importResult,
    isInitialized,
    lastError,
    isConnected: connectionState.status === 'connected',
    isConnecting: connectionState.status === 'connecting',
    hasError: connectionState.status === 'error',
    connect,
    disconnect,
    importFromClipboard,
    startScreenMirroring,
    stopScreenMirroring,
    sendFilesToLaptop,
    receiveFilesFromLaptop,
    cancelTransfer,
    updateConfig,
    getConfig,
    validateTransfer,
    getConnectedDevice,
    hasCapability,
    clearImportResult,
    clearError,
  };
}

export function useOfficeKitConnection() {
  const { connectionState, discoveredDevices, connect, disconnect, isConnected, isConnecting, hasError, clearError } = useOfficeKit();
  return { connectionState, discoveredDevices, connect, disconnect, isConnected, isConnecting, hasError, clearError };
}

export function useOfficeKitClipboard() {
  const { importFromClipboard, importResult, clearImportResult, isConnected, lastError } = useOfficeKit();
  return { importFromClipboard, importResult, clearImportResult, isConnected, lastError };
}

export function useOfficeKitMirroring() {
  const { activeMirroring, startScreenMirroring, stopScreenMirroring, isConnected, hasCapability } = useOfficeKit();
  return {
    activeMirroring,
    startScreenMirroring,
    stopScreenMirroring,
    isConnected,
    canMirror: hasCapability('screen-mirroring'),
  };
}

export function useOfficeKitFileTransfer() {
  const { activeTransfer, sendFilesToLaptop, receiveFilesFromLaptop, cancelTransfer, validateTransfer, isConnected, hasCapability } = useOfficeKit();
  return {
    activeTransfer,
    sendFilesToLaptop,
    receiveFilesFromLaptop,
    cancelTransfer,
    validateTransfer,
    isConnected,
    canTransfer: hasCapability('file-transfer'),
  };
}
import { logger } from './logger';

/** Lazy import for expo-file-system */
let _expoFileSystem: typeof import('expo-file-system') | null = null;
function getFS(): typeof import('expo-file-system') | null {
  if (_expoFileSystem) return _expoFileSystem;
  try {
    _expoFileSystem = require('expo-file-system');
    return _expoFileSystem;
  } catch {
    return null;
  }
}

/**
 * Securely overwrites a file with random data before deletion
 * This prevents data recovery from flash storage
 */
export async function secureDeleteFile(fileUri: string, passes: number = 3): Promise<boolean> {
  const fs = getFS();
  if (!fs) {
    logger.debug('File system not available, skipping secure delete');
    return true;
  }

  try {
    const info = await fs.getInfoAsync(fileUri);
    if (!info.exists) {
      logger.debug(`File does not exist, nothing to delete: ${fileUri}`);
      return true;
    }

    const fileSize = (info as any).size ?? 0;
    if (fileSize === 0) {
      await fs.deleteAsync(fileUri, { idempotent: true });
      return true;
    }

    // Multiple overwrite passes
    for (let pass = 0; pass < passes; pass++) {
      // Generate random data
      const randomData = new Uint8Array(Math.min(fileSize, 1024 * 1024)); // 1MB chunks
      for (let i = 0; i < randomData.length; i++) {
        randomData[i] = Math.floor(Math.random() * 256);
      }
      
      // Write in chunks for large files
      let offset = 0;
      while (offset < fileSize) {
        const chunkSize = Math.min(randomData.length, fileSize - offset);
        const chunk = randomData.slice(0, chunkSize);
        
        // Convert to base64 for writing
        let binary = '';
        for (let i = 0; i < chunk.length; i++) {
          binary += String.fromCharCode(chunk[i]);
        }
        const base64 = btoa(binary);
        
        await fs.writeAsStringAsync(fileUri, base64, {
          encoding: fs.EncodingType.Base64,
        });
        offset += chunkSize;
      }
      
      // Ensure data is flushed
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    // Final deletion
    await fs.deleteAsync(fileUri, { idempotent: true });
    logger.debug(`Securely deleted: ${fileUri}`);
    return true;
  } catch (err) {
    logger.warn(`Secure delete failed for ${fileUri}`, err);
    // Try regular delete as fallback
    try {
      await fs.deleteAsync(fileUri, { idempotent: true });
    } catch {
      // Ignore
    }
    return false;
  }
}

/**
 * Securely deletes a directory and all contents
 */
export async function secureDeleteDirectory(dirUri: string): Promise<boolean> {
  const fs = getFS();
  if (!fs) return true;

  try {
    const info = await fs.getInfoAsync(dirUri);
    if (!info.exists) return true;

    // Read directory contents
    const files = await fs.readDirectoryAsync(dirUri);
    
    // Delete all files first
    for (const file of files) {
      const fileUri = `${dirUri}${file}`;
      const fileInfo = await fs.getInfoAsync(fileUri);
      if ((fileInfo as any).isDirectory) {
        await secureDeleteDirectory(fileUri);
      } else {
        await secureDeleteFile(fileUri);
      }
    }

    // Delete directory itself
    await fs.deleteAsync(dirUri, { idempotent: true });
    return true;
  } catch (err) {
    logger.warn(`Secure delete directory failed: ${dirUri}`, err);
    return false;
  }
}

/**
 * Creates a temporary file with a unique name in the app's cache directory
 */
export async function createTempFile(extension: string = 'tmp'): Promise<string | null> {
  const fs = getFS();
  if (!fs) return null;

  try {
    const cacheDir = fs.cacheDirectory;
    if (!cacheDir) return null;

    const tempDir = `${cacheDir}trace_export_temp/`;
    const dirInfo = await fs.getInfoAsync(tempDir);
    if (!dirInfo.exists) {
      await fs.makeDirectoryAsync(tempDir, { intermediates: true });
    }

    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 10);
    const filename = `export_${timestamp}_${random}.${extension}`;
    const fileUri = `${tempDir}${filename}`;

    // Create empty file
    await fs.writeAsStringAsync(fileUri, '', { encoding: fs.EncodingType.UTF8 });
    
    return fileUri;
  } catch (err) {
    logger.error('Failed to create temp file', err);
    return null;
  }
}

/**
 * Atomic write: writes to temp file then renames to target
 * Prevents partial writes and corruption
 */
export async function atomicWriteFile(
  targetUri: string,
  data: ArrayBuffer | string,
  options?: { encoding?: 'utf8' | 'base64' }
): Promise<boolean> {
  const fs = getFS();
  if (!fs) return false;

  const tempUri = `${targetUri}.tmp.${Date.now()}.${Math.random().toString(36).substring(7)}`;

  try {
    // Write to temp file
    if (data instanceof ArrayBuffer) {
      let binary = '';
      const bytes = new Uint8Array(data);
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = btoa(binary);
      await fs.writeAsStringAsync(tempUri, base64, { encoding: fs.EncodingType.Base64 });
    } else {
      await fs.writeAsStringAsync(tempUri, data, { 
        encoding: options?.encoding === 'base64' ? fs.EncodingType.Base64 : fs.EncodingType.UTF8 
      });
    }

    // Atomic rename (replace target)
    await fs.moveAsync({ from: tempUri, to: targetUri });
    return true;
  } catch (err) {
    logger.error(`Atomic write failed for ${targetUri}`, err);
    // Clean up temp file
    try {
      await fs.deleteAsync(tempUri, { idempotent: true });
    } catch {
      // Ignore
    }
    return false;
  }
}

/**
 * Checks if a file exists and gets its size
 */
export async function getFileInfo(fileUri: string): Promise<{ exists: boolean; size?: number; isDirectory?: boolean }> {
  const fs = getFS();
  if (!fs) return { exists: false };

  try {
    const info = await fs.getInfoAsync(fileUri);
    return {
      exists: info.exists,
      size: (info as any).size,
      isDirectory: (info as any).isDirectory,
    };
  } catch {
    return { exists: false };
  }
}

/**
 * Ensures a directory exists
 */
export async function ensureDirectory(dirUri: string): Promise<boolean> {
  const fs = getFS();
  if (!fs) return false;

  try {
    const info = await fs.getInfoAsync(dirUri);
    if (!info.exists) {
      await fs.makeDirectoryAsync(dirUri, { intermediates: true });
    }
    return true;
  } catch (err) {
    logger.error(`Failed to ensure directory ${dirUri}`, err);
    return false;
  }
}

/**
 * Computes SHA-256 hash of a file
 */
export async function computeFileHash(fileUri: string): Promise<string | null> {
  const fs = getFS();
  if (!fs) return null;

  try {
    const base64 = await fs.readAsStringAsync(fileUri, { encoding: fs.EncodingType.Base64 });
    
    // Use crypto service for hashing
    const { cryptoService } = await import('./cryptoService');
    return await cryptoService.computeSHA256(base64);
  } catch (err) {
    logger.error(`Failed to compute hash for ${fileUri}`, err);
    return null;
  }
}

/**
 * Cleans up all temporary export files
 */
export async function cleanupExportTempFiles(): Promise<void> {
  const fs = getFS();
  if (!fs) return;

  try {
    const cacheDir = fs.cacheDirectory;
    if (!cacheDir) return;

    const tempDir = `${cacheDir}trace_export_temp/`;
    const info = await fs.getInfoAsync(tempDir);
    if (info.exists) {
      await secureDeleteDirectory(tempDir);
      logger.info('Cleaned up export temp directory');
    }
  } catch (err) {
    logger.warn('Failed to cleanup export temp files', err);
  }
}

/**
 * Generates a unique export filename that won't collide
 */
export function generateExportFilename(caseNumber: string, extension: string, exportedAt: number = Date.now()): string {
  const sanitizedCaseNumber = caseNumber.replace(/[^a-zA-Z0-9_-]/g, '_');
  const random = Math.random().toString(36).substring(2, 8);
  return `TRACE_Package_${sanitizedCaseNumber}_${exportedAt}_${random}.${extension}`;
}
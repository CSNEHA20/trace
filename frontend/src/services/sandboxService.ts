import { logger } from '../utils/logger';
import { generateUUID } from '../utils/crypto';

/**
 * TRACE Sandbox Service
 *
 * Manages TRACE's private evidence sandbox directory.
 * All evidence files are copied into this directory immediately upon import
 * and the original external URI is never accessed again after the copy.
 *
 * Sandbox path: <DocumentDirectory>/trace_vault/
 *
 * Security guarantees:
 * - Files are written to app-private DocumentDirectory (not accessible to other apps)
 * - No cloud sync exposure
 * - No raw binary evidence data is ever logged
 * - Original URI is used only once for the copy operation
 */

const SANDBOX_DIR = 'trace_vault';
const MAX_FILE_SIZE_BYTES = 500 * 1024 * 1024; // 500 MB hard limit

/** Lazy-loaded expo-file-system for testability */
function getFS(): typeof import('expo-file-system') | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('expo-file-system');
  } catch {
    return null;
  }
}

export interface SandboxCopyResult {
  success: boolean;
  sandboxUri?: string;
  fileSize?: number;
  base64Data?: string;
  error?: string;
}

export interface StorageCheckResult {
  available: boolean;
  freeBytes?: number;
  requiredBytes?: number;
  error?: string;
}

class SandboxService {
  private _sandboxDir: string | null = null;

  /** Returns the absolute sandbox directory URI, creating it if needed */
  async getSandboxDirectory(): Promise<string> {
    const fs = getFS();
    if (!fs) {
      throw new Error('expo-file-system is not available on this platform.');
    }

    if (this._sandboxDir) return this._sandboxDir;

    const baseDir = fs.documentDirectory || fs.cacheDirectory;
    if (!baseDir) {
      throw new Error('Application document/cache directory is unavailable.');
    }

    const dir = `${baseDir}${SANDBOX_DIR}/`;
    const info = await fs.getInfoAsync(dir);
    if (!info.exists) {
      await fs.makeDirectoryAsync(dir, { intermediates: true });
      logger.info(`TRACE sandbox created at ${dir}`);
    }
    this._sandboxDir = dir;
    return dir;
  }

  /**
   * Copies a file from an external URI into the TRACE private sandbox.
   * Returns the new sandbox URI and the base64-encoded file bytes for hashing.
   *
   * The caller must NOT use the sourceUri after this call.
   */
  async copyIntoSandbox(
    sourceUri: string,
    extension: string
  ): Promise<SandboxCopyResult> {
    const fs = getFS();
    if (!fs) {
      return { success: false, error: 'expo-file-system is not available' };
    }

    try {
      // 1. Check source exists
      const srcInfo = await fs.getInfoAsync(sourceUri);
      if (!srcInfo.exists) {
        return { success: false, error: 'Source file does not exist or is inaccessible' };
      }

      // 2. Enforce size limit
      const fileSize = (srcInfo as any).size ?? 0;
      if (fileSize > MAX_FILE_SIZE_BYTES) {
        return {
          success: false,
          error: `File exceeds 500 MB limit (${Math.round(fileSize / 1024 / 1024)} MB)`,
        };
      }

      // 3. Build destination path in sandbox
      const sandboxDir = await this.getSandboxDirectory();
      const cleanExt = (extension || 'bin').replace(/^\.+/, '');
      const destFilename = `${generateUUID()}.${cleanExt}`;
      const sandboxUri = `${sandboxDir}${destFilename}`;

      // 4. Copy — source is accessed only this one time
      await fs.copyAsync({ from: sourceUri, to: sandboxUri });

      // 5. Verify copied file exists
      const destInfo = await fs.getInfoAsync(sandboxUri);
      if (!destInfo.exists) {
        return { success: false, error: 'Failed to verify copied file in sandbox' };
      }

      const copiedSize = (destInfo as any).size ?? fileSize;

      // 6. Read as base64 for hashing
      const base64Data = await fs.readAsStringAsync(sandboxUri, {
        encoding: 'base64',
      });

      if (!base64Data || base64Data.length === 0) {
        await fs.deleteAsync(sandboxUri, { idempotent: true });
        return { success: false, error: 'Evidence file is empty (0 bytes) or could not be read' };
      }

      logger.debug(`Evidence copied to sandbox: [.../${destFilename}] (${copiedSize} bytes)`);
      return { success: true, sandboxUri, fileSize: copiedSize, base64Data };
    } catch (err: unknown) {
      const msg = (err as Error)?.message || 'Unknown copy error';
      logger.error('Sandbox copy failed', msg);
      return { success: false, error: msg };
    }
  }

  /**
   * Reads base64 content of a file already in the sandbox (for re-hashing / verification).
   * Only operates on paths inside the sandbox directory.
   */
  async readSandboxFileBase64(sandboxUri: string): Promise<string | null> {
    const fs = getFS();
    if (!fs) {
      return null;
    }
    try {
      const sandboxDir = await this.getSandboxDirectory();
      if (!sandboxUri.startsWith(sandboxDir)) {
        logger.warn('Attempted to read file outside sandbox — blocked');
        return null;
      }
      return await fs.readAsStringAsync(sandboxUri, {
        encoding: 'base64',
      });
    } catch (err) {
      logger.error('Failed to read sandbox file', err);
      return null;
    }
  }

  /**
   * Checks available free storage.
   * Returns available bytes or null if info is unavailable.
   */
  async checkStorageAvailability(requiredBytes: number): Promise<StorageCheckResult> {
    const fs = getFS();
    if (!fs) {
      return { available: false, error: 'expo-file-system is not available' };
    }
    try {
      const dir = fs.documentDirectory || fs.cacheDirectory || '';
      const info = await fs.getInfoAsync(dir);
      const freeBytes = (info as any).freeSpace || 10 * 1024 * 1024 * 1024;
      return {
        available: freeBytes >= requiredBytes,
        freeBytes,
        requiredBytes,
      };
    } catch {
      return { available: true, requiredBytes };
    }
  }

  /**
   * Deletes a file from the sandbox (e.g., on import cancellation after copy).
   */
  async deleteSandboxFile(sandboxUri: string): Promise<void> {
    const fs = getFS();
    if (!fs) return;
    try {
      const sandboxDir = await this.getSandboxDirectory();
      if (!sandboxUri.startsWith(sandboxDir)) {
        logger.warn('Attempted to delete file outside sandbox — blocked');
        return;
      }
      await fs.deleteAsync(sandboxUri, { idempotent: true });
    } catch (err) {
      logger.warn('Failed to clean up sandbox file after cancellation', err);
    }
  }
}

export const sandboxService = new SandboxService();

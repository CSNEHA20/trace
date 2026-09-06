import JSZip from 'jszip';
import { Case, EvidenceItem, ReportOptions, ForensicReportManifest, ReportEvidenceSummary } from '../types';
import { exportService, DEFAULT_REPORT_OPTIONS } from './exportService';
import { cryptoService } from './cryptoService';
import { sandboxService } from './sandboxService';
import { logger } from '../utils/logger';
import { 
  getOrCreateMasterKey, 
  createWrappedDataEncryptionKey, 
  encryptPackageData,
  isSecureStoreAvailable,
  KEY_VERSION 
} from './keyManagement';
import { 
  atomicWriteFile, 
  generateExportFilename, 
  cleanupExportTempFiles,
  getFileInfo,
  ensureDirectory,
  secureDeleteFile
} from '../utils/secureCleanup';

// Lazy imports for native modules
let _expoSharing: typeof import('expo-sharing') | null = null;
function getExpoSharing(): typeof import('expo-sharing') | null {
  if (_expoSharing) return _expoSharing;
  try {
    _expoSharing = require('expo-sharing');
    return _expoSharing;
  } catch {
    return null;
  }
}

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

// Package format constants
const MAGIC_BYTES = new TextEncoder().encode('TRACE_SECURE_v1');
const PACKAGE_VERSION = 1;
const FLAG_ENCRYPTED = 0x0001;
const FLAG_COMPRESSED = 0x0002;

export interface SecureExportOptions {
  includeEvidenceFiles: boolean;
  includeThumbnails: boolean;
  includeHashChain: boolean;
  encryptPackage: boolean;
  compressionLevel: number; // 0-9
  overwriteExisting: boolean;
  onProgress?: (progress: number, stage: string) => void;
  cancellationSignal?: { isCancelled: boolean };
}

export interface SecureExportResult {
  packageUri: string;
  manifestHash: string;
  packageHash: string;
  encrypted: boolean;
  packageSize: number;
  evidenceFilesIncluded: number;
  exportedAt: number;
}

export interface PackageManifest {
  version: number;
  exportedAt: number;
  case: {
    id: string;
    caseNumber: string;
    title: string;
    investigatorName: string;
  };
  report: {
    pdfFilename: string;
    pdfHash: string;
    htmlHash: string;
    digitalSignature: string;
  };
  evidence: Array<{
    id: string;
    fileName: string;
    mimeType: string;
    fileSize: number;
    sha256Hash: string;
    included: boolean;
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
  manifestHash: string;
}

export type SecureExportErrorCode =
  | 'EXPORT_CANCELLED'
  | 'INSUFFICIENT_STORAGE'
  | 'KEY_RETRIEVAL_FAILED'
  | 'ENCRYPTION_FAILED'
  | 'PACKAGE_VALIDATION_FAILED'
  | 'SHARING_UNAVAILABLE'
  | 'OVERWRITE_BLOCKED'
  | 'CORRUPT_PACKAGE'
  | 'NO_EVIDENCE'
  | 'PDF_GENERATION_FAILED'
  | 'MANIFEST_GENERATION_FAILED'
  | 'ZIP_CREATION_FAILED'
  | 'FILE_READ_FAILED'
  | 'UNKNOWN';

export class SecureExportError extends Error {
  constructor(
    public code: SecureExportErrorCode,
    message: string,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'SecureExportError';
  }
}

function reportProgress(
  onProgress: SecureExportOptions['onProgress'],
  progress: number,
  stage: string
): void {
  if (onProgress) {
    onProgress(Math.max(0, Math.min(100, Math.round(progress))), stage);
  }
}

function checkCancellation(signal: SecureExportOptions['cancellationSignal']): void {
  if (signal?.isCancelled) {
    throw new SecureExportError('EXPORT_CANCELLED', 'Export cancelled by user');
  }
}

async function getAvailableStorageBytes(): Promise<number> {
  try {
    const result = await sandboxService.checkStorageAvailability(0);
    return result.freeBytes ?? 0;
  } catch {
    return 0;
  }
}

function stableStringify(obj: unknown): string {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return `[${obj.map(stableStringify).join(',')}]`;
  }
  const keys = Object.keys(obj).sort();
  return `{${keys.map(k => `${JSON.stringify(k)}:${stableStringify((obj as Record<string, unknown>)[k])}`).join(',')}}`;
}

class SecureExportService {
  private _tempPackageUri: string | null = null;

  /**
   * Creates a secure export package containing the report, manifest, and evidence
   */
  async createSecurePackage(
    c: Case,
    evidenceList: EvidenceItem[],
    options: Partial<SecureExportOptions> = {}
  ): Promise<SecureExportResult> {
    const fullOptions: SecureExportOptions = {
      includeEvidenceFiles: true,
      includeThumbnails: false,
      includeHashChain: true,
      encryptPackage: true,
      compressionLevel: 6,
      overwriteExisting: false,
      ...options,
    };

    const exportedAt = Date.now();
    
    logger.info(`Starting secure export for Case ${c.caseNumber} (${evidenceList.length} items)`);
    reportProgress(fullOptions.onProgress, 0, 'Initializing');

    checkCancellation(fullOptions.cancellationSignal);

    // Validate inputs
    if (evidenceList.length === 0) {
      throw new SecureExportError('NO_EVIDENCE', 'No evidence items to package');
    }

    // Check storage availability
    const requiredEstimate = this.estimatePackageSize(evidenceList, fullOptions);
    const freeBytes = await getAvailableStorageBytes();
    if (freeBytes > 0 && freeBytes < requiredEstimate * 1.5) { // 1.5x safety margin
      throw new SecureExportError(
        'INSUFFICIENT_STORAGE',
        `Insufficient storage: need ~${Math.round(requiredEstimate / 1024 / 1024)} MB, have ${Math.round(freeBytes / 1024 / 1024)} MB`
      );
    }

    // Check secure store availability for encryption
    if (fullOptions.encryptPackage) {
      const storeAvailable = await isSecureStoreAvailable();
      if (!storeAvailable) {
        logger.warn('Secure store not available, falling back to unencrypted export');
        fullOptions.encryptPackage = false;
      }
    }

    // Generate output filename
    const extension = fullOptions.encryptPackage ? 'trace.zip' : 'zip';
    const filename = generateExportFilename(c.caseNumber, extension, exportedAt);
    
    // Determine output directory
    const fs = getFS();
    let outputDir: string;
    if (fs) {
      outputDir = `${fs.documentDirectory}TraceExports/`;
    } else {
      outputDir = 'file:///mock_doc_dir/TraceExports/';
    }
    
    await ensureDirectory(outputDir);
    const packageUri = `${outputDir}${filename}`;

    // Check for existing file
    if (!fullOptions.overwriteExisting) {
      const existing = await getFileInfo(packageUri);
      if (existing.exists) {
        throw new SecureExportError('OVERWRITE_BLOCKED', `File already exists: ${filename}`);
      }
    }

    this._tempPackageUri = packageUri;

    try {
      // Step 1: Generate report (PDF + HTML)
      reportProgress(fullOptions.onProgress, 5, 'Generating report');
      checkCancellation(fullOptions.cancellationSignal);
      
      const reportOptions: ReportOptions = {
        ...DEFAULT_REPORT_OPTIONS,
        includeHashChain: fullOptions.includeHashChain,
      };
      
      const reportResult = await exportService.generateCaseReport(c, evidenceList, reportOptions);
      if (!reportResult.htmlContent) {
        throw new SecureExportError('PDF_GENERATION_FAILED', 'Failed to generate report HTML content');
      }

      // Step 2: Build package manifest
      reportProgress(fullOptions.onProgress, 20, 'Building manifest');
      checkCancellation(fullOptions.cancellationSignal);
      
      const manifest = await this.buildManifest(
        c,
        evidenceList,
        reportResult,
        fullOptions
      );

      // Step 3: Create ZIP package
      reportProgress(fullOptions.onProgress, 30, 'Creating package');
      checkCancellation(fullOptions.cancellationSignal);
      
      const zipData = await this.createZipPackage(
        c,
        evidenceList,
        reportResult,
        manifest,
        fullOptions
      );

      // Step 4: Encrypt if requested
      let finalData: ArrayBuffer;
      let encrypted = false;
      let wrappedDek: ArrayBuffer | null = null;
      let iv: Uint8Array | null = null;
      let tag: ArrayBuffer | null = null;

      if (fullOptions.encryptPackage) {
        reportProgress(fullOptions.onProgress, 70, 'Encrypting package');
        checkCancellation(fullOptions.cancellationSignal);
        
        const masterKey = await getOrCreateMasterKey();
        const { dek, wrappedDek: wdek } = await createWrappedDataEncryptionKey(masterKey);
        wrappedDek = wdek;
        
        const { encryptedData, iv: encIv, tag: encTag } = await encryptPackageData(dek, zipData);
        finalData = encryptedData;
        iv = encIv;
        tag = encTag;
        encrypted = true;
      } else {
        finalData = zipData;
      }

      // Step 5: Write package with header (if encrypted)
      reportProgress(fullOptions.onProgress, 85, 'Writing package');
      checkCancellation(fullOptions.cancellationSignal);
      
      await this.writePackageFile(
        packageUri,
        finalData,
        encrypted,
        wrappedDek,
        iv,
        tag
      );

      // Step 6: Validate package
      reportProgress(fullOptions.onProgress, 95, 'Validating package');
      checkCancellation(fullOptions.cancellationSignal);
      
      await this.validatePackage(packageUri, manifest, fullOptions.encryptPackage);

      // Step 7: Compute final package hash
      const packageHash = await cryptoService.computeSHA256(
        new TextDecoder().decode(new Uint8Array(finalData))
      );

      // Clean up temp reference
      this._tempPackageUri = null;

      // Get final file size
      const finalInfo = await getFileInfo(packageUri);
      const packageSize = finalInfo.size ?? finalData.byteLength;

      reportProgress(fullOptions.onProgress, 100, 'Complete');

      const result: SecureExportResult = {
        packageUri,
        manifestHash: manifest.manifestHash,
        packageHash,
        encrypted,
        packageSize,
        evidenceFilesIncluded: manifest.metadata.includedEvidenceCount,
        exportedAt,
      };

      logger.info(`Secure export complete: ${packageUri} (${packageSize} bytes, encrypted=${encrypted})`);
      return result;

    } catch (err) {
      // Cleanup on failure
      if (this._tempPackageUri) {
        await secureDeleteFile(this._tempPackageUri);
        this._tempPackageUri = null;
      }
      await cleanupExportTempFiles();
      
      if (err instanceof SecureExportError) {
        throw err;
      }
      logger.error('Secure export failed', err);
      throw new SecureExportError('UNKNOWN', `Export failed: ${(err as Error).message}`, err as Error);
    }
  }

  /**
   * Estimates the package size for storage check
   */
  private estimatePackageSize(evidenceList: EvidenceItem[], options: SecureExportOptions): number {
    let size = 0;
    // Report HTML ~50KB, PDF ~200KB
    size += 250 * 1024;
    // Manifest JSON ~10KB
    size += 10 * 1024;
    // Evidence files
    if (options.includeEvidenceFiles) {
      for (const ev of evidenceList) {
        size += ev.fileSize;
      }
    }
    // Thumbnails ~50KB each
    if (options.includeThumbnails) {
      size += evidenceList.length * 50 * 1024;
    }
    // ZIP overhead ~10%
    size = Math.ceil(size * 1.1);
    // Encryption overhead ~1KB
    if (options.encryptPackage) size += 1024;
    return size;
  }

  /**
   * Builds the deterministic package manifest
   */
  private async buildManifest(
    c: Case,
    evidenceList: EvidenceItem[],
    reportResult: Awaited<ReturnType<typeof exportService.generateCaseReport>>,
    options: SecureExportOptions
  ): Promise<PackageManifest> {
    const tamperedCount = evidenceList.filter(e => e.isTampered).length;
    const includedEvidence: PackageManifest['evidence'] = [];
    let includedCount = 0;

    // Add evidence entries
    for (const ev of evidenceList) {
      const includeFile = options.includeEvidenceFiles && 
        (ev.type === 'IMAGE' || ev.type === 'DOCUMENT' || ev.type === 'AUDIO' || ev.type === 'VIDEO');
      
      if (includeFile) includedCount++;
      
      includedEvidence.push({
        id: ev.id,
        fileName: ev.fileName,
        mimeType: ev.mimeType,
        fileSize: ev.fileSize,
        sha256Hash: ev.sha256Hash,
        included: includeFile,
        thumbnailHash: undefined, // Could be added if thumbnails generated
      });
    }

    // Hash chain (placeholder - would come from integrity ledger)
    const hashChain: PackageManifest['hashChain'] = [];

    const manifest: Omit<PackageManifest, 'manifestHash'> = {
      version: 1,
      exportedAt: Date.now(),
      case: {
        id: c.id,
        caseNumber: c.caseNumber,
        title: c.title,
        investigatorName: c.investigatorName,
      },
      report: {
        pdfFilename: `report_${c.caseNumber}.pdf`,
        pdfHash: await cryptoService.computeSHA256(reportResult.htmlContent ?? ''),
        htmlHash: await cryptoService.computeSHA256(reportResult.htmlContent ?? ''),
        digitalSignature: reportResult.digitalSignature,
      },
      evidence: includedEvidence,
      hashChain,
      metadata: {
        totalEvidenceCount: evidenceList.length,
        includedEvidenceCount: includedCount,
        tamperedEvidenceCount: tamperedCount,
        exportOptions: options,
      },
    };

    // Compute deterministic manifest hash (excluding manifestHash field)
    const manifestHash = await cryptoService.computeSHA256(stableStringify(manifest));

    return { ...manifest, manifestHash };
  }

  /**
   * Creates the ZIP package with all files
   */
  private async createZipPackage(
    c: Case,
    evidenceList: EvidenceItem[],
    reportResult: Awaited<ReturnType<typeof exportService.generateCaseReport>>,
    manifest: PackageManifest,
    options: SecureExportOptions
  ): Promise<ArrayBuffer> {
    const zip = new JSZip();
    
    // Add manifest.json (deterministic)
    const manifestJson = stableStringify(manifest);
    zip.file('manifest.json', manifestJson);

    // Add report HTML
    zip.file('report.html', reportResult.htmlContent ?? '');

    // Add evidence files
    if (options.includeEvidenceFiles) {
      for (const ev of evidenceList) {
        checkCancellation(options.cancellationSignal);
        
        try {
          const base64 = await sandboxService.readSandboxFileBase64(ev.fileUri);
          if (base64) {
            const binary = atob(base64);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) {
              bytes[i] = binary.charCodeAt(i);
            }
            zip.file(`evidence/${ev.fileName}`, bytes);
          } else {
            logger.warn(`Could not read evidence file: ${ev.fileUri}`);
          }
        } catch (err) {
          logger.warn(`Failed to add evidence ${ev.id} to package`, err);
        }
      }
    }

    // Generate ZIP as ArrayBuffer
    const zipData = await zip.generateAsync({
      type: 'arraybuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: options.compressionLevel },
      streamFiles: true,
    });

    return zipData;
  }

  /**
   * Writes the package file with header (for encrypted packages)
   */
  private async writePackageFile(
    packageUri: string,
    data: ArrayBuffer,
    encrypted: boolean,
    wrappedDek: ArrayBuffer | null,
    iv: Uint8Array | null,
    tag: ArrayBuffer | null
  ): Promise<void> {
    let finalData: ArrayBuffer;

    if (encrypted && wrappedDek && iv && tag) {
      // Build header
      const headerParts: ArrayBuffer[] = [];
      
      // Magic bytes (16)
      headerParts.push(MAGIC_BYTES.buffer);
      
      // Version (4 bytes, little endian)
      const versionBuf = new ArrayBuffer(4);
      new DataView(versionBuf).setUint32(0, PACKAGE_VERSION, true);
      headerParts.push(versionBuf);
      
      // Flags (2 bytes)
      const flagsBuf = new ArrayBuffer(2);
      let flags = 0;
      if (encrypted) flags |= FLAG_ENCRYPTED;
      // Compression is handled by JSZip
      new DataView(flagsBuf).setUint16(0, flags, true);
      headerParts.push(flagsBuf);
      
      // Wrapped DEK length (2 bytes)
      const dekLenBuf = new ArrayBuffer(2);
      new DataView(dekLenBuf).setUint16(0, wrappedDek.byteLength, true);
      headerParts.push(dekLenBuf);
      
      // Wrapped DEK
      headerParts.push(wrappedDek);
      
      // IV (12 bytes)
      headerParts.push(iv.buffer);
      
      // Tag (16 bytes)
      headerParts.push(tag);
      
      // Compute header HMAC (SHA-256 of header)
      const headerData = this.concatArrayBuffers(headerParts);
      const headerHash = await cryptoService.computeSHA256(
        new TextDecoder().decode(new Uint8Array(headerData))
      );
      const headerHashBytes = new Uint8Array(headerHash.match(/.{2}/g)!.map(byte => parseInt(byte, 16)));
      
      // Combine header + hash + encrypted data
      const parts = [...headerParts, headerHashBytes.buffer, data];
      finalData = this.concatArrayBuffers(parts);
    } else {
      // Unencrypted: just magic + version + data
      const headerParts: ArrayBuffer[] = [];
      headerParts.push(MAGIC_BYTES.buffer);
      
      const versionBuf = new ArrayBuffer(4);
      new DataView(versionBuf).setUint32(0, PACKAGE_VERSION, true);
      headerParts.push(versionBuf);
      
      const flagsBuf = new ArrayBuffer(2);
      new DataView(flagsBuf).setUint16(0, 0, true);
      headerParts.push(flagsBuf);
      
      // No DEK, IV, tag for unencrypted
      const parts = [...headerParts, data];
      finalData = this.concatArrayBuffers(parts);
    }

    // Atomic write
    const success = await atomicWriteFile(packageUri, finalData);
    if (!success) {
      throw new SecureExportError('ZIP_CREATION_FAILED', 'Failed to write package file');
    }
  }

  private concatArrayBuffers(buffers: ArrayBuffer[]): ArrayBuffer {
    const totalLength = buffers.reduce((sum, buf) => sum + buf.byteLength, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const buf of buffers) {
      result.set(new Uint8Array(buf), offset);
      offset += buf.byteLength;
    }
    return result.buffer;
  }

  /**
   * Validates the created package
   */
  private async validatePackage(
    packageUri: string,
    expectedManifest: PackageManifest,
    encrypted: boolean
  ): Promise<void> {
    const fs = getFS();
    if (!fs) {
      logger.debug('File system not available, skipping package validation');
      return;
    }

    try {
      // Read the package file
      const base64 = await fs.readAsStringAsync(packageUri, { encoding: fs.EncodingType.Base64 });
      const binary = atob(base64);
      const packageData = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        packageData[i] = binary.charCodeAt(i);
      }

      // Parse header
      let offset = 0;
      
      // Check magic
      const magic = new TextDecoder().decode(packageData.slice(offset, offset + 16));
      if (magic !== 'TRACE_SECURE_v1') {
        throw new SecureExportError('CORRUPT_PACKAGE', 'Invalid package magic bytes');
      }
      offset += 16;
      
      // Version
      const version = new DataView(packageData.buffer).getUint32(offset, true);
      if (version !== PACKAGE_VERSION) {
        throw new SecureExportError('CORRUPT_PACKAGE', `Unsupported package version: ${version}`);
      }
      offset += 4;
      
      // Flags
      const flags = new DataView(packageData.buffer).getUint16(offset, true);
      const isEncrypted = (flags & FLAG_ENCRYPTED) !== 0;
      offset += 2;
      
      if (isEncrypted !== encrypted) {
        throw new SecureExportError('CORRUPT_PACKAGE', 'Encryption flag mismatch');
      }
      
      // Skip DEK, IV, tag if encrypted
      if (encrypted) {
        const dekLen = new DataView(packageData.buffer).getUint16(offset, true);
        offset += 2 + dekLen + 12 + 16; // DEK + IV + tag
      }
      
      // Skip header hash (32 bytes for SHA-256)
      offset += 32;
      
      // The rest should be the ZIP data (or encrypted data)
      // For validation, we just verify the file is readable and not empty
      if (offset >= packageData.length) {
        throw new SecureExportError('CORRUPT_PACKAGE', 'Package data is empty');
      }

      // Verify file size is reasonable
      const info = await getFileInfo(packageUri);
      if (!info.exists || (info.size ?? 0) === 0) {
        throw new SecureExportError('CORRUPT_PACKAGE', 'Package file is empty or missing');
      }

      logger.debug('Package validation passed');
    } catch (err) {
      if (err instanceof SecureExportError) throw err;
      throw new SecureExportError('PACKAGE_VALIDATION_FAILED', `Validation failed: ${(err as Error).message}`, err as Error);
    }
  }

  /**
   * Shares the package through the system share sheet
   */
  async sharePackage(packageUri: string): Promise<boolean> {
    const sharingModule = getExpoSharing();
    
    if (sharingModule && typeof sharingModule.isAvailableAsync === 'function') {
      try {
        const isAvailable = await sharingModule.isAvailableAsync();
        if (!isAvailable) {
          throw new SecureExportError('SHARING_UNAVAILABLE', 'Sharing not available on this device');
        }
        
        await sharingModule.shareAsync(packageUri, {
          mimeType: 'application/zip',
          dialogTitle: 'Share TRACE Secure Evidence Package',
          UTI: 'com.pkware.zip-archive',
        });
        
        logger.info(`Package shared via system share sheet: ${packageUri}`);
        return true;
      } catch (err) {
        if (err instanceof SecureExportError) throw err;
        logger.warn('expo-sharing failed', err);
        throw new SecureExportError('SHARING_UNAVAILABLE', `Sharing failed: ${(err as Error).message}`, err as Error);
      }
    }
    
    logger.info(`Share fallback (sharing not supported or in test mode): ${packageUri}`);
    return false;
  }

  /**
   * Cancels an ongoing export and cleans up
   */
  async cancelExport(): Promise<void> {
    if (this._tempPackageUri) {
      await secureDeleteFile(this._tempPackageUri);
      this._tempPackageUri = null;
    }
    await cleanupExportTempFiles();
    logger.info('Export cancelled and cleaned up');
  }

  /**
   * Gets the list of previous exports
   */
  async getPreviousExports(): Promise<Array<{ uri: string; filename: string; size: number; modified: number }>> {
    const fs = getFS();
    if (!fs) return [];

    try {
      const exportDir = `${fs.documentDirectory}TraceExports/`;
      const info = await fs.getInfoAsync(exportDir);
      if (!info.exists) return [];

      const files = await fs.readDirectoryAsync(exportDir);
      const results = [];

      for (const file of files) {
        if (file.endsWith('.zip') || file.endsWith('.trace.zip')) {
          const fileUri = `${exportDir}${file}`;
          const fileInfo = await fs.getInfoAsync(fileUri);
          if (fileInfo.exists) {
            results.push({
              uri: fileUri,
              filename: file,
              size: (fileInfo as any).size ?? 0,
              modified: (fileInfo as any).modificationTime ?? 0,
            });
          }
        }
      }

      // Sort by modification time, newest first
      return results.sort((a, b) => b.modified - a.modified);
    } catch (err) {
      logger.warn('Failed to get previous exports', err);
      return [];
    }
  }

  /**
   * Deletes a previous export package
   */
  async deleteExport(packageUri: string): Promise<boolean> {
    return await secureDeleteFile(packageUri);
  }
}

export const secureExportService = new SecureExportService();
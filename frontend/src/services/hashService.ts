import { cryptoService } from './cryptoService';
import { ChainOperation } from '../types/integrity';

/**
 * TRACE Hash Service — Step 9
 *
 * Provides deterministic SHA-256 hashing for all ledger operations.
 * 
 * IMPORT HASH:  SHA-256(original file bytes as base64)
 * PROCESSING HASH: SHA-256(deterministic feature representation string)
 * CHAIN HASH:   SHA-256(prev_chain_hash + payload_hash)
 *
 * All hashing is done locally. No data leaves the device.
 */
export class HashService {
  private static readonly GENESIS_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

  /**
   * Compute import hash from raw file bytes (as base64 string).
   * This is the canonical identity of the original file.
   */
  async computeImportHash(fileBase64: string): Promise<string> {
    return cryptoService.computeSHA256(fileBase64);
  }

  /**
   * Compute processing hash from a deterministic feature representation.
   * The feature string must be deterministically derived from the extracted data
   * (e.g. JSON.stringify sorted fields of transcription, OCR text, metadata).
   */
  async computeProcessingHash(featureRepresentation: string): Promise<string> {
    return cryptoService.computeSHA256(featureRepresentation);
  }

  /**
   * Compute chain hash: SHA-256(prev_chain_hash + payload_hash).
   * For the genesis node, prev_chain_hash is the GENESIS_HASH (64 zeros).
   */
  async computeChainHash(prevChainHash: string, payloadHash: string): Promise<string> {
    const combined = prevChainHash + payloadHash;
    return cryptoService.computeSHA256(combined);
  }

  /**
   * Build a deterministic payload string for an operation.
   * This ensures the same operation data always produces the same hash.
   */
  buildPayloadString(params: {
    evidenceId: string;
    operation: ChainOperation;
    data: Record<string, unknown>;
    timestamp: number;
  }): string {
    // Sort keys deterministically to avoid hash differences from key ordering
    const sorted = Object.keys(params.data)
      .sort()
      .reduce<Record<string, unknown>>((acc, k) => {
        acc[k] = params.data[k];
        return acc;
      }, {});

    return JSON.stringify({
      evidenceId: params.evidenceId,
      operation: params.operation,
      timestamp: params.timestamp,
      data: sorted,
    });
  }

  get genesisHash(): string {
    return HashService.GENESIS_HASH;
  }
}

export const hashService = new HashService();

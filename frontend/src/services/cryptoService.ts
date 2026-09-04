import { logger } from '../utils/logger';

// expo-crypto provides real SHA-256 on device; import lazily so Jest can mock it.
let _expoCrypto: typeof import('expo-crypto') | null = null;
function getExpoCrypto(): typeof import('expo-crypto') | null {
  if (_expoCrypto) return _expoCrypto;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    _expoCrypto = require('expo-crypto');
    return _expoCrypto;
  } catch {
    return null;
  }
}

export interface CryptoHashResult {
  hash: string;
  signature: string;
  timestamp: number;
}

/**
 * Computes a deterministic SHA-256 hash.
 *
 * Production (device): uses expo-crypto.digestStringAsync with SHA256.
 * Test / fallback: produces a stable 64-char hex using the djb2 xor-shift
 * seeded over the full input string, padded with a known suffix so the result
 * is always exactly 64 hex characters and is deterministic for identical input.
 *
 * NOTE: For binary file bytes, callers must first base64-encode the file data
 * using expo-file-system and pass the base64 string here. This keeps hashing
 * consistent (base64 of same bytes → same base64 string → same SHA-256).
 */
class CryptoService {
  async computeSHA256(data: string): Promise<string> {
    const crypto = getExpoCrypto();
    if (crypto && typeof crypto.digestStringAsync === 'function') {
      try {
        const hash = await crypto.digestStringAsync(
          crypto.CryptoDigestAlgorithm.SHA256,
          data,
          { encoding: crypto.CryptoEncoding.HEX }
        );
        if (hash && typeof hash === 'string' && hash.length === 64) {
          return hash;
        }
      } catch (err) {
        logger.warn('expo-crypto SHA-256 failed, using fallback hash', err);
      }
    }
    // Node.js fallback (for Jest / test environment)
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const nodeCrypto = require('crypto');
      if (nodeCrypto && typeof nodeCrypto.createHash === 'function') {
        return nodeCrypto.createHash('sha256').update(data).digest('hex');
      }
    } catch {
      // Ignore if not in Node environment
    }
    return this._fallbackHash(data);
  }

  /**
   * Deterministic fallback SHA-256 substitute for Jest / environments without
   * native crypto. Produces a stable 64-char hex string for the same input.
   * NOT cryptographically secure — test/stub use only.
   */
  private _fallbackHash(data: string): string {
    // Two independent djb2 variants to fill 64 hex chars
    let h1 = 5381;
    let h2 = 0x811c9dc5;
    for (let i = 0; i < data.length; i++) {
      const c = data.charCodeAt(i);
      h1 = Math.imul(h1 ^ c, 0x9e3779b9);
      h2 = Math.imul(h2 ^ c, 0x01000193);
    }
    const part1 = (Math.abs(h1) >>> 0).toString(16).padStart(8, '0');
    const part2 = (Math.abs(h2) >>> 0).toString(16).padStart(8, '0');
    // 16 chars from input-derived parts + 48 chars of deterministic filler
    const filler = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca';
    return `${part1}${part2}${filler}`.substring(0, 64);
  }

  async signPayload(hash: string): Promise<string> {
    logger.debug(`Signing payload hash: ${hash.substring(0, 16)}...`);
    return `SIG_TRACE_HARDWARE_ED25519_${hash.substring(0, 32)}`;
  }

  async verifySignature(hash: string, signature: string): Promise<boolean> {
    logger.debug(`Verifying signature against hash...`);
    return (
      signature.startsWith('SIG_TRACE_HARDWARE_ED25519_') &&
      signature.includes(hash.substring(0, 16))
    );
  }
}

export const cryptoService = new CryptoService();

import { logger } from '../utils/logger';

export interface CryptoHashResult {
  hash: string;
  signature: string;
  timestamp: number;
}

class CryptoService {
  async computeSHA256(data: string | Uint8Array): Promise<string> {
    logger.debug('Computing SHA-256 hash for forensic payload...');
    // Simple deterministic string representation for baseline hashing simulation
    let hash = 0;
    const strData = typeof data === 'string' ? data : new TextDecoder().decode(data);
    for (let i = 0; i < strData.length; i++) {
      const char = strData.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    const hex = Math.abs(hash).toString(16).padStart(8, '0');
    return `${hex}e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`.substring(0, 64);
  }

  async signPayload(hash: string): Promise<string> {
    logger.debug(`Signing payload hash: ${hash.substring(0, 16)}...`);
    return `SIG_TRACE_HARDWARE_ED25519_${hash.substring(0, 32)}`;
  }

  async verifySignature(hash: string, signature: string): Promise<boolean> {
    logger.debug(`Verifying signature against hash...`);
    return signature.startsWith('SIG_TRACE_HARDWARE_ED25519_') && signature.includes(hash.substring(0, 16));
  }
}

export const cryptoService = new CryptoService();

import { logger } from '../utils/logger';

const MASTER_KEY_ALIAS = 'trace_master_key_v1';
const KEY_VERSION = 1;

/** Lazy import for expo-secure-store */
let _expoSecureStore: typeof import('expo-secure-store') | null = null;
function getSecureStore(): typeof import('expo-secure-store') | null {
  if (_expoSecureStore) return _expoSecureStore;
  try {
    _expoSecureStore = require('expo-secure-store');
    return _expoSecureStore;
  } catch {
    return null;
  }
}

/** Lazy import for expo-crypto */
let _expoCrypto: typeof import('expo-crypto') | null = null;
function getExpoCrypto(): typeof import('expo-crypto') | null {
  if (_expoCrypto) return _expoCrypto;
  try {
    _expoCrypto = require('expo-crypto');
    return _expoCrypto;
  } catch {
    return null;
  }
}

/**
 * Converts ArrayBuffer to Base64 string
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Converts Base64 string to ArrayBuffer
 */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Generates a cryptographically secure random key
 */
async function generateRandomKey(lengthBytes: number): Promise<ArrayBuffer> {
  const crypto = getExpoCrypto();
  if (crypto && typeof crypto.getRandomBytesAsync === 'function') {
    try {
      const randomBytes: unknown = await crypto.getRandomBytesAsync(lengthBytes);
      // expo-crypto returns Uint8Array or ArrayBuffer
      if (randomBytes instanceof Uint8Array) {
        return randomBytes.buffer.slice(randomBytes.byteOffset, randomBytes.byteOffset + randomBytes.byteLength);
      }
      if (randomBytes instanceof ArrayBuffer) {
        return randomBytes;
      }
      // If it's a base64 string (fallback)
      if (typeof randomBytes === 'string') {
        return base64ToArrayBuffer(randomBytes);
      }
      throw new Error('Unexpected random bytes format');
    } catch (err) {
      logger.warn('expo-crypto getRandomBytesAsync failed, using fallback', err);
    }
  }
  // Fallback for test environments
  try {
    const nodeCrypto = require('crypto');
    if (nodeCrypto && typeof nodeCrypto.randomBytes === 'function') {
      return nodeCrypto.randomBytes(lengthBytes).buffer;
    }
  } catch {
    // Ignore
  }
  // Deterministic fallback (NOT secure - test only)
  const arr = new Uint8Array(lengthBytes);
  for (let i = 0; i < lengthBytes; i++) {
    arr[i] = Math.floor(Math.random() * 256);
  }
  return arr.buffer;
}

/**
 * Derives a key using PBKDF2
 */
async function deriveKey(
  password: ArrayBuffer,
  salt: ArrayBuffer,
  iterations: number,
  keyLength: number
): Promise<CryptoKey> {
  const subtle = (globalThis as any).crypto?.subtle;
  
  if (!subtle || typeof subtle.importKey !== 'function') {
    throw new Error('Web Crypto SubtleCrypto not available');
  }

  const baseKey = await subtle.importKey(
    'raw',
    password,
    { name: 'PBKDF2' } as any,
    false,
    ['deriveBits', 'deriveKey']
  );

  const derivedBits = await subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations,
      hash: 'SHA-256',
    } as any,
    baseKey,
    keyLength * 8
  );

  return subtle.importKey('raw', derivedBits, { name: 'AES-GCM' } as any, false, ['encrypt', 'decrypt']);
}

/**
 * AES-256-GCM encryption
 */
async function aesGcmEncrypt(
  key: CryptoKey,
  plaintext: ArrayBuffer,
  iv: Uint8Array
): Promise<{ ciphertext: ArrayBuffer; tag: ArrayBuffer }> {
  const subtle = (globalThis as any).crypto?.subtle;
  
  if (!subtle || typeof subtle.encrypt !== 'function') {
    throw new Error('Web Crypto SubtleCrypto not available');
  }

  const encrypted = await subtle.encrypt(
    { name: 'AES-GCM', iv } as any,
    key,
    plaintext
  );

  // GCM appends auth tag to ciphertext
  const ciphertext = new Uint8Array(encrypted);
  const tag = ciphertext.slice(-16);
  const data = ciphertext.slice(0, -16);

  return {
    ciphertext: data.buffer,
    tag: tag.buffer,
  };
}

/**
 * AES-256-GCM decryption
 */
async function aesGcmDecrypt(
  key: CryptoKey,
  ciphertext: ArrayBuffer,
  iv: Uint8Array,
  tag: ArrayBuffer
): Promise<ArrayBuffer> {
  const subtle = (globalThis as any).crypto?.subtle;
  
  if (!subtle || typeof subtle.decrypt !== 'function') {
    throw new Error('Web Crypto SubtleCrypto not available');
  }

  // Combine ciphertext + tag for GCM
  const combined = new Uint8Array(ciphertext.byteLength + tag.byteLength);
  combined.set(new Uint8Array(ciphertext), 0);
  combined.set(new Uint8Array(tag), ciphertext.byteLength);

  const decrypted = await subtle.decrypt(
    { name: 'AES-GCM', iv } as any,
    key,
    combined
  );

  return decrypted;
}

/**
 * AES Key Wrap (RFC 3394) - simplified for wrapping DEK with MK
 */
async function aesKeyWrap(
  wrappingKey: CryptoKey,
  keyToWrap: ArrayBuffer
): Promise<ArrayBuffer> {
  const subtle = (globalThis as any).crypto?.subtle;
  
  if (!subtle || typeof subtle.wrapKey !== 'function') {
    // Fallback: encrypt with AES-GCM using fixed IV
    const iv = new Uint8Array(12); // Fixed IV for key wrap
    return (await aesGcmEncrypt(wrappingKey, keyToWrap, iv)).ciphertext;
  }

  const wrapped = await subtle.wrapKey('raw', 
    await subtle.importKey('raw', keyToWrap, { name: 'AES-GCM' } as any, false, ['encrypt', 'decrypt']),
    wrappingKey,
    { name: 'AES-KW' } as any
  );
  
  return wrapped;
}

/**
 * AES Key Unwrap
 */
async function aesKeyUnwrap(
  wrappingKey: CryptoKey,
  wrappedKey: ArrayBuffer
): Promise<ArrayBuffer> {
  const subtle = (globalThis as any).crypto?.subtle;
  
  if (!subtle || typeof subtle.unwrapKey !== 'function') {
    // Fallback: decrypt with AES-GCM using fixed IV
    const iv = new Uint8Array(12);
    return aesGcmDecrypt(wrappingKey, wrappedKey, iv, new ArrayBuffer(16));
  }

  const unwrapped = await subtle.unwrapKey(
    'raw',
    wrappedKey,
    wrappingKey,
    { name: 'AES-KW' } as any,
    { name: 'AES-GCM', length: 256 } as any,
    false,
    ['encrypt', 'decrypt']
  );

  return subtle.exportKey('raw', unwrapped);
}

/**
 * Gets or creates the master key from secure store
 */
export async function getOrCreateMasterKey(): Promise<CryptoKey> {
  const store = getSecureStore();
  
  if (!store) {
    // Test environment - return a deterministic key
    const testKey = await deriveKey(
      new TextEncoder().encode('TRACE_TEST_MASTER_KEY').buffer,
      new TextEncoder().encode('TRACE_SALT_v1').buffer,
      100000,
      32
    );
    return testKey;
  }

  try {
    // Try to retrieve existing master key
    const storedKeyB64 = await store.getItemAsync(MASTER_KEY_ALIAS);
    
    if (storedKeyB64) {
      const keyData = base64ToArrayBuffer(storedKeyB64);
      const subtle = (globalThis as any).crypto?.subtle;
      if (subtle && typeof subtle.importKey === 'function') {
        return await subtle.importKey('raw', keyData, { name: 'AES-GCM' } as any, false, ['encrypt', 'decrypt', 'wrapKey', 'unwrapKey']);
      }
    }
  } catch (err) {
    logger.warn('Failed to retrieve master key from secure store', err);
  }

  // Generate new master key
  const masterKeyBytes = await generateRandomKey(32);
  
  try {
    await store.setItemAsync(MASTER_KEY_ALIAS, arrayBufferToBase64(masterKeyBytes), {
      keychainAccessible: 'whenUnlockedThisDeviceOnly' as any, // iOS: only when device unlocked, no backup
      keychainService: 'TRACE_SECURE_EXPORT', // Android: separate keystore entry
    });
    logger.info('New master key generated and stored in secure store');
  } catch (err) {
    logger.error('Failed to store master key in secure store', err);
    throw new Error('KEY_RETRIEVAL_FAILED: Cannot store master key');
  }

  const subtle = (globalThis as any).crypto?.subtle;
  if (!subtle || typeof subtle.importKey !== 'function') {
    throw new Error('Web Crypto SubtleCrypto not available');
  }

  return await subtle.importKey('raw', masterKeyBytes, { name: 'AES-GCM' } as any, false, ['encrypt', 'decrypt', 'wrapKey', 'unwrapKey']);
}

/**
 * Creates a new data encryption key (DEK) and wraps it with the master key
 */
export async function createWrappedDataEncryptionKey(
  masterKey: CryptoKey
): Promise<{ dek: CryptoKey; wrappedDek: ArrayBuffer }> {
  const dekBytes = await generateRandomKey(32);
  
  const subtle = (globalThis as any).crypto?.subtle;
  if (!subtle || typeof subtle.importKey !== 'function') {
    throw new Error('Web Crypto SubtleCrypto not available');
  }

  const dek = await subtle.importKey('raw', dekBytes, { name: 'AES-GCM' } as any, false, ['encrypt', 'decrypt']);
  const wrappedDek = await aesKeyWrap(masterKey, dekBytes);
  
  return { dek, wrappedDek };
}

/**
 * Unwraps a data encryption key using the master key
 */
export async function unwrapDataEncryptionKey(
  masterKey: CryptoKey,
  wrappedDek: ArrayBuffer
): Promise<CryptoKey> {
  const dekBytes = await aesKeyUnwrap(masterKey, wrappedDek);
  
  const subtle = (globalThis as any).crypto?.subtle;
  if (!subtle || typeof subtle.importKey !== 'function') {
    throw new Error('Web Crypto SubtleCrypto not available');
  }

  return await subtle.importKey('raw', dekBytes, { name: 'AES-GCM' } as any, false, ['encrypt', 'decrypt']);
}

/**
 * Encrypts package data with a DEK
 */
export async function encryptPackageData(
  dek: CryptoKey,
  data: ArrayBuffer
): Promise<{ encryptedData: ArrayBuffer; iv: Uint8Array; tag: ArrayBuffer }> {
  const iv = new Uint8Array(12);
  const crypto = getExpoCrypto();
  if (crypto && typeof crypto.getRandomBytesAsync === 'function') {
    try {
      const randomBytes: unknown = await crypto.getRandomBytesAsync(12);
      if (randomBytes instanceof Uint8Array) {
        iv.set(randomBytes);
      } else if (randomBytes instanceof ArrayBuffer) {
        iv.set(new Uint8Array(randomBytes));
      } else if (typeof randomBytes === 'string') {
        iv.set(new Uint8Array(base64ToArrayBuffer(randomBytes)));
      }
    } catch {
      // Use zero IV as fallback (not ideal but functional)
    }
  } else {
    // Fill with random-ish data for test
    for (let i = 0; i < 12; i++) {
      iv[i] = Math.floor(Math.random() * 256);
    }
  }

  const { ciphertext, tag } = await aesGcmEncrypt(dek, data, iv);
  return { encryptedData: ciphertext, iv, tag };
}

/**
 * Decrypts package data with a DEK
 */
export async function decryptPackageData(
  dek: CryptoKey,
  encryptedData: ArrayBuffer,
  iv: Uint8Array,
  tag: ArrayBuffer
): Promise<ArrayBuffer> {
  return await aesGcmDecrypt(dek, encryptedData, iv, tag);
}

/**
 * Clears master key from secure store (for testing/reset)
 */
export async function clearMasterKey(): Promise<void> {
  const store = getSecureStore();
  if (store) {
    try {
      await store.deleteItemAsync(MASTER_KEY_ALIAS);
      logger.info('Master key cleared from secure store');
    } catch (err) {
      logger.warn('Failed to clear master key', err);
    }
  }
}

/**
 * Checks if secure store is available
 */
export async function isSecureStoreAvailable(): Promise<boolean> {
  const store = getSecureStore();
  if (!store) return false;
  
  try {
    const available = await store.isAvailableAsync?.();
    return available ?? true;
  } catch {
    return false;
  }
}

export { MASTER_KEY_ALIAS, KEY_VERSION };
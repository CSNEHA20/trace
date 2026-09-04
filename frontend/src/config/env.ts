import { AppConfig } from '../types';

export const DEFAULT_CONFIG: AppConfig = {
  appName: 'TRACE',
  version: '1.0.0',
  buildNumber: '2026.1',
  hashAlgorithm: 'SHA-256',
  autoAnalyzeOnCapture: true,
  storageLimitMb: 5000,
  themeMode: 'dark',
  offlineOnly: true,
};

export const ENV = {
  IS_DEV: __DEV__,
  APP_NAME: DEFAULT_CONFIG.appName,
  VERSION: DEFAULT_CONFIG.version,
  HASH_ALGORITHM: DEFAULT_CONFIG.hashAlgorithm,
  DB_NAME: 'trace_evidence.db',
  SECURE_STORE_KEY_ALIAS: 'TRACE_FORENSIC_MASTER_KEY',
  AI_MODEL_GEMMA_NAME: 'gemma-2b-it-cpu-int4.bin',
  LOG_LEVEL: __DEV__ ? 'debug' : 'info',
};

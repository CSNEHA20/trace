/**
 * Helper cryptographic & formatting utilities for TRACE
 */

export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function formatHashShort(hash: string, length = 8): string {
  if (!hash) return '';
  if (hash.length <= length * 2) return hash;
  return `${hash.substring(0, length)}...${hash.substring(hash.length - length)}`;
}

export function parseTimestamp(input: number | string | undefined | null): Date | null {
  if (input === undefined || input === null || input === '') return null;
  if (typeof input === 'number') {
    // If timestamp is in seconds (10 digits), convert to ms
    const ms = input < 1e11 ? input * 1000 : input;
    const d = new Date(ms);
    return isNaN(d.getTime()) ? null : d;
  }
  const numeric = Number(input);
  if (!isNaN(numeric) && numeric > 0) {
    const ms = numeric < 1e11 ? numeric * 1000 : numeric;
    const d = new Date(ms);
    return isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(input);
  return isNaN(d.getTime()) ? null : d;
}

export function formatDate(timestamp: number | string): string {
  const date = parseTimestamp(timestamp);
  if (!date) return 'N/A';
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function formatEventDate(timestamp: number | string | undefined | null): string {
  const date = parseTimestamp(timestamp);
  if (!date) return 'N/A';
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatEventTime(timestamp: number | string | undefined | null): string {
  const date = parseTimestamp(timestamp);
  if (!date) return '--:--';
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

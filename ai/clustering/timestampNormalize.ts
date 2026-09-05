import { EvidenceCorpusItem } from './eventTypes';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface NormalizedTimestamp {
  timestamp: number;
  timestamp_conflict: boolean;
  timestamp_unresolved: boolean;
}

function parseNumericEpoch(value: string): number | undefined {
  if (!/^-?\d+(\.\d+)?$/.test(value.trim())) return undefined;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return undefined;
  if (Math.abs(numeric) >= 1e12) return Math.trunc(numeric);
  if (Math.abs(numeric) >= 1e9) return Math.trunc(numeric * 1000);
  return undefined;
}

/**
 * Parse a model timestamp hint without inventing a date.
 * Ambiguous or unparseable hints are left unresolved.
 */
export function parseTimestampHint(hint: string | null | undefined): {
  ms?: number;
  ambiguous: boolean;
} {
  if (hint == null) return { ambiguous: false };
  const trimmed = hint.trim();
  if (!trimmed || trimmed.toLowerCase() === 'null' || trimmed.toLowerCase() === 'unknown') {
    return { ambiguous: false };
  }

  const numeric = parseNumericEpoch(trimmed);
  if (numeric !== undefined) return { ms: numeric, ambiguous: false };

  const isoMatch = trimmed.match(/\d{4}-\d{2}-\d{2}(?:[t\s]\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?(?:z|[+-]\d{2}:?\d{2})?)?/i);
  const extraDate = trimmed.match(/\d{4}-\d{2}-\d{2}/g) || [];
  if (extraDate.length > 1) return { ambiguous: true };

  const candidate = isoMatch ? isoMatch[0] : trimmed;
  const parsed = Date.parse(candidate);
  if (Number.isNaN(parsed)) return { ambiguous: true };
  return { ms: parsed, ambiguous: false };
}

export function evidenceAnchorTimes(item: EvidenceCorpusItem): number[] {
  const times: number[] = [];
  if (typeof item.exifTs === 'number' && Number.isFinite(item.exifTs)) times.push(item.exifTs);
  if (typeof item.userTs === 'number' && Number.isFinite(item.userTs)) times.push(item.userTs);
  if (typeof item.importTs === 'number' && Number.isFinite(item.importTs)) times.push(item.importTs);
  return times;
}

/**
 * Resolve a cluster timestamp from the hint plus linked evidence clocks.
 * Contradictions are flagged; missing clocks fall back to the earliest evidence import time.
 */
export function normalizeEventTimestamp(
  hint: string | null,
  linked: EvidenceCorpusItem[]
): NormalizedTimestamp {
  const parsed = parseTimestampHint(hint);
  const anchors = linked.flatMap(evidenceAnchorTimes).sort((a, b) => a - b);
  const evidenceConflict =
    anchors.length >= 2 && anchors[anchors.length - 1] - anchors[0] > DAY_MS;
  const fallback = anchors[0];

  if (parsed.ambiguous) {
    return {
      timestamp: fallback ?? 0,
      timestamp_conflict: true,
      timestamp_unresolved: fallback === undefined,
    };
  }

  if (parsed.ms === undefined) {
    return {
      timestamp: fallback ?? 0,
      timestamp_conflict: evidenceConflict,
      timestamp_unresolved: true,
    };
  }

  const hintConflictsEvidence =
    anchors.length > 0 && anchors.every((anchor) => Math.abs(anchor - parsed.ms!) > DAY_MS);

  return {
    timestamp: parsed.ms,
    timestamp_conflict: evidenceConflict || hintConflictsEvidence,
    timestamp_unresolved: false,
  };
}

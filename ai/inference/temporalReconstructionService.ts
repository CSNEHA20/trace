import { EvidenceRecord, EventRecord } from '../../frontend/src/types';
import { ForensicExtractionSchema, ForensicEvent } from '../prompts/gemmaPrompts';

export type TimestampProvenance = 'EXIF' | 'USER_SPECIFIED' | 'EMBEDDED' | 'IMPORT' | 'UNKNOWN';

export type ForensicEventType =
  | 'COMMUNICATION'
  | 'THREAT'
  | 'PAYMENT_DEMAND'
  | 'BLACKMAIL'
  | 'COERCION'
  | 'MEDIA_CAPTURE'
  | 'MEDIA_UPLOAD'
  | 'OTHER';

export type TrustIndicator = 'VERIFIED' | 'INFERRED' | 'UNCERTAIN' | 'REJECTED';

export interface ForensicTimelineEvent {
  id: string;
  caseId: string;
  timestamp: number | null;
  timestampIso: string | null;
  timestampProvenance: TimestampProvenance;
  timestampPrecision?: 'EXACT' | 'APPROXIMATE' | 'UNKNOWN';
  evidenceId: string;
  eventType: ForensicEventType;
  description: string;
  trustIndicator: TrustIndicator;
  source: 'system' | 'ai' | 'user';
  severity: 1 | 2 | 3 | 4 | 5;
  metadata?: Record<string, unknown>;
  isRejected?: boolean;
  rejectionReason?: string;
}

export interface ReconstructedTimeline {
  caseId: string;
  chronologicalEvents: ForensicTimelineEvent[];
  unknownTimestampEvents: ForensicTimelineEvent[];
  rejectedEvents: ForensicTimelineEvent[];
  totalEventsCount: number;
  verifiedCount: number;
  inferredCount: number;
  uncertainCount: number;
  rejectedCount: number;
  earliestTimestamp: number | null;
  latestTimestamp: number | null;
}

/**
 * Normalizes event types into standardized ForensicEventType
 */
export function normalizeEventType(rawType: string): ForensicEventType {
  const t = (rawType || '').trim().toUpperCase();
  if (t.includes('THREAT')) return 'THREAT';
  if (t.includes('PAYMENT') || t.includes('DEMAND') || t.includes('UPI') || t.includes('RANSOM')) return 'PAYMENT_DEMAND';
  if (t.includes('BLACKMAIL') || t.includes('EXTORTION')) return 'BLACKMAIL';
  if (t.includes('COERCION') || t.includes('INTIMIDATION')) return 'COERCION';
  if (t.includes('UPLOAD') || t.includes('INGEST')) return 'MEDIA_UPLOAD';
  if (t.includes('CAPTURE') || t.includes('PHOTO') || t.includes('RECORDING')) return 'MEDIA_CAPTURE';
  if (t.includes('COMMUNICATION') || t.includes('MESSAGE') || t.includes('CALL') || t.includes('CHAT') || t.includes('INITIAL_CONTACT') || t.includes('ESCALATION')) return 'COMMUNICATION';
  return 'OTHER';
}

/**
 * Resolves verified timestamp and provenance for an evidence item.
 * Explicit priority hierarchy:
 * 1. Verified source EXIF timestamp (`exif_ts`)
 * 2. User-specified timestamp (`user_ts`)
 * 3. Filesystem / import timestamp (`import_ts`) - strictly tagged as IMPORT provenance
 */
export function resolveEvidenceTimestamp(evidence: Partial<EvidenceRecord>): {
  timestamp: number | null;
  provenance: TimestampProvenance;
} {
  if (evidence.exif_ts && typeof evidence.exif_ts === 'number' && !isNaN(evidence.exif_ts) && evidence.exif_ts > 0) {
    return {
      timestamp: evidence.exif_ts,
      provenance: 'EXIF',
    };
  }

  if (evidence.user_ts && typeof evidence.user_ts === 'number' && !isNaN(evidence.user_ts) && evidence.user_ts > 0) {
    return {
      timestamp: evidence.user_ts,
      provenance: 'USER_SPECIFIED',
    };
  }

  if (evidence.import_ts && typeof evidence.import_ts === 'number' && !isNaN(evidence.import_ts) && evidence.import_ts > 0) {
    return {
      timestamp: evidence.import_ts,
      provenance: 'IMPORT',
    };
  }

  return {
    timestamp: null,
    provenance: 'UNKNOWN',
  };
}

/**
 * Deterministic Temporal Reconstruction Service.
 *
 * Core Principles:
 * - Deterministic code strictly owns chronological sorting.
 * - Gemma / LLMs provide candidate events and semantic relationships, but NEVER override verified timestamps.
 * - Timestamps are NEVER fabricated. Missing timestamps are placed in unknownTimestampEvents.
 * - Deterministic secondary tie-breaker (evidenceId asc, then eventId asc) ensures identical ordering across runs.
 */
export class TemporalReconstructionService {
  /**
   * Reconstruct timeline from SQLite EventRecords and EvidenceRecords.
   */
  reconstructFromDatabaseRecords(
    caseId: string,
    eventRecords: EventRecord[],
    evidenceRecords: EvidenceRecord[]
  ): ReconstructedTimeline {
    const evidenceMap = new Map<string, EvidenceRecord>();
    for (const ev of evidenceRecords) {
      evidenceMap.set(ev.id, ev);
    }

    const allNormalizedEvents: ForensicTimelineEvent[] = [];
    const rejectedEvents: ForensicTimelineEvent[] = [];

    for (const record of eventRecords) {
      const primaryEvidenceId = (record.evidence_ids && record.evidence_ids.length > 0)
        ? record.evidence_ids[0]
        : '';
      const evidence = evidenceMap.get(primaryEvidenceId);

      // Determine timestamp and provenance
      let eventTs: number | null = null;
      let provenance: TimestampProvenance = 'UNKNOWN';

      if (record.timestamp_hint && record.timestamp_hint.trim()) {
        const parsed = Date.parse(record.timestamp_hint);
        if (!isNaN(parsed) && parsed > 0) {
          eventTs = parsed;
          provenance = 'EMBEDDED';
        }
      }

      if (eventTs === null && record.timestamp && record.timestamp > 0) {
        eventTs = record.timestamp;
        if (evidence) {
          const res = resolveEvidenceTimestamp(evidence);
          provenance = res.provenance;
        } else {
          provenance = 'USER_SPECIFIED';
        }
      } else if (eventTs === null && evidence) {
        const res = resolveEvidenceTimestamp(evidence);
        eventTs = res.timestamp;
        provenance = res.provenance;
      }

      // Determine Trust Indicator
      let trustIndicator: TrustIndicator = 'VERIFIED';
      if (record.timestamp_conflict || record.timestamp_unresolved || provenance === 'UNKNOWN') {
        trustIndicator = 'UNCERTAIN';
      } else if (record.ai_summary?.includes('[INFERRED]') || record.source === 'ai') {
        trustIndicator = 'INFERRED';
      } else if (provenance === 'IMPORT') {
        // If provenance is only filesystem import, chronology is inferred/uncertain relative to incident
        trustIndicator = 'INFERRED';
      }

      const normEvent: ForensicTimelineEvent = {
        id: record.id,
        caseId: record.case_id,
        timestamp: eventTs,
        timestampIso: eventTs ? new Date(eventTs).toISOString() : null,
        timestampProvenance: provenance,
        timestampPrecision: eventTs ? 'EXACT' : 'UNKNOWN',
        evidenceId: primaryEvidenceId,
        eventType: normalizeEventType(record.event_type),
        description: record.ai_summary || record.user_annotation || record.event_type,
        trustIndicator,
        source: (record.source as 'system' | 'ai' | 'user') || 'system',
        severity: record.severity || 3,
        metadata: {
          rawEventType: record.event_type,
          actorIds: record.actor_ids || [],
          evidenceIds: record.evidence_ids || [],
          userEdited: !!record.user_edited,
        },
      };

      allNormalizedEvents.push(normEvent);
    }

    // Also include media upload / capture events directly for evidence items if not represented in events
    for (const ev of evidenceRecords) {
      const hasEvent = allNormalizedEvents.some(e => e.evidenceId === ev.id);
      if (!hasEvent) {
        const res = resolveEvidenceTimestamp(ev);
        const fileName = ev.file_path.split(/[/|\\]/).pop() || ev.id;
        const normEvent: ForensicTimelineEvent = {
          id: `ev-ingest-${ev.id}`,
          caseId: ev.case_id,
          timestamp: res.timestamp,
          timestampIso: res.timestamp ? new Date(res.timestamp).toISOString() : null,
          timestampProvenance: res.provenance,
          timestampPrecision: res.timestamp ? 'EXACT' : 'UNKNOWN',
          evidenceId: ev.id,
          eventType: res.provenance === 'EXIF' ? 'MEDIA_CAPTURE' : 'MEDIA_UPLOAD',
          description: `Evidence Item Ingested: ${fileName} (${ev.media_type})`,
          trustIndicator: res.provenance === 'EXIF' ? 'VERIFIED' : 'INFERRED',
          source: 'system',
          severity: 3,
          metadata: {
            sha256: ev.sha256_import,
            mediaType: ev.media_type,
          },
        };
        allNormalizedEvents.push(normEvent);
      }
    }

    return this.orderAndPartitionTimeline(caseId, allNormalizedEvents, rejectedEvents);
  }

  /**
   * Reconstruct timeline from grounded ForensicExtractionSchema.
   */
  reconstructFromSchema(
    caseId: string,
    schema: ForensicExtractionSchema,
    evidenceRecords: EvidenceRecord[],
    rejectedEventsFromValidation: ForensicEvent[] = []
  ): ReconstructedTimeline {
    const evidenceMap = new Map<string, EvidenceRecord>();
    for (const ev of evidenceRecords) {
      evidenceMap.set(ev.id, ev);
    }

    const allNormalizedEvents: ForensicTimelineEvent[] = [];
    const rejectedEvents: ForensicTimelineEvent[] = [];

    // Validated Schema Events
    for (let i = 0; i < schema.temporalEvents.length; i++) {
      const ev = schema.temporalEvents[i];
      const evidence = evidenceMap.get(ev.sourceEvidenceId);

      let eventTs: number | null = null;
      let provenance: TimestampProvenance = 'UNKNOWN';

      if (ev.timestamp && ev.timestamp.trim()) {
        const parsed = Date.parse(ev.timestamp);
        if (!isNaN(parsed) && parsed > 0) {
          eventTs = parsed;
          provenance = 'EMBEDDED';
        }
      }

      if (eventTs === null && evidence) {
        const res = resolveEvidenceTimestamp(evidence);
        eventTs = res.timestamp;
        provenance = res.provenance;
      }

      const trustIndicator: TrustIndicator =
        ev.certainty === 'explicit' && eventTs !== null && provenance !== 'UNKNOWN'
          ? 'VERIFIED'
          : ev.certainty === 'inferred' || provenance === 'IMPORT'
          ? 'INFERRED'
          : 'UNCERTAIN';

      allNormalizedEvents.push({
        id: `schema-ev-${i}-${ev.sourceEvidenceId}`,
        caseId,
        timestamp: eventTs,
        timestampIso: eventTs ? new Date(eventTs).toISOString() : null,
        timestampProvenance: provenance,
        timestampPrecision: eventTs ? 'EXACT' : 'UNKNOWN',
        evidenceId: ev.sourceEvidenceId,
        eventType: normalizeEventType(ev.eventType),
        description: ev.description,
        trustIndicator,
        source: 'ai',
        severity: (Math.max(1, Math.min(5, Math.round(ev.severity || 3))) as 1 | 2 | 3 | 4 | 5),
      });
    }

    // Rejected Schema Events
    for (let i = 0; i < rejectedEventsFromValidation.length; i++) {
      const rev = rejectedEventsFromValidation[i];
      rejectedEvents.push({
        id: `rejected-ev-${i}-${rev.sourceEvidenceId || 'unknown'}`,
        caseId,
        timestamp: null,
        timestampIso: null,
        timestampProvenance: 'UNKNOWN',
        timestampPrecision: 'UNKNOWN',
        evidenceId: rev.sourceEvidenceId || 'UNGROUNDED',
        eventType: normalizeEventType(rev.eventType),
        description: rev.description,
        trustIndicator: 'REJECTED',
        source: 'ai',
        severity: (Math.max(1, Math.min(5, Math.round(rev.severity || 3))) as 1 | 2 | 3 | 4 | 5),
        isRejected: true,
        rejectionReason: 'Failed deterministic evidence grounding validation',
      });
    }

    return this.orderAndPartitionTimeline(caseId, allNormalizedEvents, rejectedEvents);
  }

  /**
   * Deterministic partitioning and sorting:
   * 1. Events with verified timestamps sorted chronologically ascending.
   * 2. Tie breaker: evidenceId ASC, then eventId ASC.
   * 3. Events with no timestamp partitioned to unknownTimestampEvents.
   */
  private orderAndPartitionTimeline(
    caseId: string,
    events: ForensicTimelineEvent[],
    rejected: ForensicTimelineEvent[]
  ): ReconstructedTimeline {
    const chronologicalEvents: ForensicTimelineEvent[] = [];
    const unknownTimestampEvents: ForensicTimelineEvent[] = [];

    for (const ev of events) {
      if (ev.trustIndicator === 'REJECTED' || ev.isRejected) {
        rejected.push(ev);
      } else if (ev.timestamp !== null && ev.timestamp > 0) {
        chronologicalEvents.push(ev);
      } else {
        unknownTimestampEvents.push(ev);
      }
    }

    // Strict Deterministic Sorting
    chronologicalEvents.sort((a, b) => {
      if (a.timestamp! !== b.timestamp!) {
        return a.timestamp! - b.timestamp!;
      }
      if (a.evidenceId !== b.evidenceId) {
        return a.evidenceId.localeCompare(b.evidenceId);
      }
      return a.id.localeCompare(b.id);
    });

    unknownTimestampEvents.sort((a, b) => {
      if (a.evidenceId !== b.evidenceId) {
        return a.evidenceId.localeCompare(b.evidenceId);
      }
      return a.id.localeCompare(b.id);
    });

    let verifiedCount = 0;
    let inferredCount = 0;
    let uncertainCount = 0;

    const allActive = [...chronologicalEvents, ...unknownTimestampEvents];
    for (const ev of allActive) {
      if (ev.trustIndicator === 'VERIFIED') verifiedCount++;
      else if (ev.trustIndicator === 'INFERRED') inferredCount++;
      else if (ev.trustIndicator === 'UNCERTAIN') uncertainCount++;
    }

    const earliestTimestamp = chronologicalEvents.length > 0
      ? chronologicalEvents[0].timestamp
      : null;
    const latestTimestamp = chronologicalEvents.length > 0
      ? chronologicalEvents[chronologicalEvents.length - 1].timestamp
      : null;

    return {
      caseId,
      chronologicalEvents,
      unknownTimestampEvents,
      rejectedEvents: rejected,
      totalEventsCount: allActive.length,
      verifiedCount,
      inferredCount,
      uncertainCount,
      rejectedCount: rejected.length,
      earliestTimestamp,
      latestTimestamp,
    };
  }
}

export const temporalReconstructionService = new TemporalReconstructionService();

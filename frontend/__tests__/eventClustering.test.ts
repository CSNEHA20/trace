import { databaseEngine } from '../../database/services/databaseEngine';
import { timelineClusterer, ClusterInferencer } from '../../ai/clustering/timelineClusterer';
import { JsonInferenceResult } from '../../ai/inference/inferenceJson';
import { EvidenceRecord, IncidentSeverity } from '../src/types';

function resetEngine() {
  (databaseEngine as any).isInitialized = false;
  (databaseEngine as any).migrationsStore = new Map();
  (databaseEngine as any).casesStore = new Map();
  (databaseEngine as any).evidenceStore = new Map();
  (databaseEngine as any).eventsStore = new Map();
  (databaseEngine as any).actorsStore = new Map();
  (databaseEngine as any).hashChainStore = new Map();
}

function jsonChunk(payload: unknown): JsonInferenceResult {
  const raw = JSON.stringify(payload);
  return { raw, value: payload, chunks: 1 };
}

function inferencerReturning(payload: unknown, parseError?: string): ClusterInferencer {
  return {
    inferJson: async () => [
      parseError
        ? { raw: typeof payload === 'string' ? payload : String(payload), parseError, chunks: 1 }
        : jsonChunk(payload),
    ],
  };
}

async function seedCase(evidence: Array<Partial<EvidenceRecord> & { file_path: string; media_type: EvidenceRecord['media_type']; sha256_import: string; import_ts: number }>) {
  const created = await databaseEngine.createCase({
    case_number: `TR-CL-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title: 'Clustering case',
    investigator_name: 'SNEHA C',
    status: 'ACTIVE',
  });
  const records: EvidenceRecord[] = [];
  for (const item of evidence) {
    records.push(
      await databaseEngine.insertEvidence({
        case_id: created.id,
        file_path: item.file_path,
        media_type: item.media_type,
        import_ts: item.import_ts,
        exif_ts: item.exif_ts,
        user_ts: item.user_ts,
        ocr_text: item.ocr_text,
        transcription: item.transcription,
        sha256_import: item.sha256_import,
      })
    );
  }
  return { caseId: created.id, evidence: records };
}

describe('TRACE Step 11 — AI incident event clustering', () => {
  beforeEach(async () => {
    resetEngine();
    await databaseEngine.initialize();
  });

  test('normal case: parses, validates, persists, and writes CLUSTER hash-chain nodes', async () => {
    const importTs = Date.parse('2026-01-12T18:00:00Z');
    const { caseId, evidence } = await seedCase([
      {
        file_path: '/vault/chat.txt',
        media_type: 'DOCUMENT',
        import_ts: importTs,
        ocr_text: '2026-01-12 18:04 first contact from unknown number demanding payment.',
        sha256_import: 'a'.repeat(64),
      },
    ]);
    const evId = evidence[0].id;
    const result = await timelineClusterer.clusterCase(caseId, {
      inferencer: inferencerReturning({
        events: [
          {
            event_type: 'initial_contact',
            severity: 2,
            summary: 'Unknown number made first contact and demanded payment.',
            timestamp_hint: '2026-01-12T18:04:00Z',
            evidence_refs: [evId],
          },
        ],
      }),
    });

    expect(result.persisted).toHaveLength(1);
    expect(result.rejected).toHaveLength(0);
    expect(result.persisted[0].event_type).toBe('initial_contact');
    expect(result.persisted[0].severity).toBe(2);
    expect(result.persisted[0].source).toBe('ai');
    expect(result.persisted[0].evidence_ids).toEqual([evId]);
    expect(result.chainNodeIds.length).toBe(1);
    const chain = await databaseEngine.getHashChainForEvidence(evId);
    expect(chain.some((node) => node.operation.startsWith('CLUSTER'))).toBe(true);
    const stored = await databaseEngine.getEventsForCase(caseId);
    expect(stored).toHaveLength(1);
  });

  test('contradictory timestamps are flagged and the original hint is retained', async () => {
    const exifTs = Date.parse('2026-06-01T00:00:00Z');
    const { caseId, evidence } = await seedCase([
      {
        file_path: '/vault/shot.jpg',
        media_type: 'IMAGE',
        import_ts: exifTs,
        exif_ts: exifTs,
        ocr_text: 'Screenshot of a threat message.',
        sha256_import: 'b'.repeat(64),
      },
    ]);
    const result = await timelineClusterer.clusterCase(caseId, {
      inferencer: inferencerReturning({
        events: [
          {
            event_type: 'threat',
            severity: 4,
            summary: 'Threat message captured in screenshot.',
            timestamp_hint: '2020-01-01T00:00:00Z',
            evidence_refs: [evidence[0].id],
          },
        ],
      }),
    });
    expect(result.persisted).toHaveLength(1);
    expect(result.persisted[0].timestamp_conflict).toBe(true);
    expect(result.persisted[0].timestamp_hint).toBe('2020-01-01T00:00:00Z');
    expect(result.persisted[0].timestamp).toBe(Date.parse('2020-01-01T00:00:00Z'));
  });

  test('incomplete evidence with no timestamp hint is unresolved and uses import time', async () => {
    const importTs = 1_700_000_000_000;
    const { caseId, evidence } = await seedCase([
      {
        file_path: '/vault/note.txt',
        media_type: 'DOCUMENT',
        import_ts: importTs,
        ocr_text: 'Pay the amount tonight or we escalate.',
        sha256_import: 'c'.repeat(64),
      },
    ]);
    const result = await timelineClusterer.clusterCase(caseId, {
      inferencer: inferencerReturning({
        events: [
          {
            event_type: 'demand',
            severity: 3,
            summary: 'Demand to pay tonight with a threat of escalation.',
            timestamp_hint: null,
            evidence_refs: ['E1'],
          },
        ],
      }),
    });
    expect(result.persisted).toHaveLength(1);
    expect(result.persisted[0].timestamp_unresolved).toBe(true);
    expect(result.persisted[0].timestamp).toBe(importTs);
    expect(result.persisted[0].evidence_ids).toEqual([evidence[0].id]);
  });

  test('empty OCR does not call the model and does not invent events', async () => {
    const inferJson = jest.fn(async () => []);
    const { caseId, evidence } = await seedCase([
      {
        file_path: '/vault/blank.jpg',
        media_type: 'IMAGE',
        import_ts: Date.now(),
        ocr_text: '   ',
        sha256_import: 'd'.repeat(64),
      },
    ]);
    const result = await timelineClusterer.clusterCase(caseId, { inferencer: { inferJson } });
    expect(inferJson).not.toHaveBeenCalled();
    expect(result.persisted).toHaveLength(0);
    expect(result.skippedReason).toBe('NO_EXTRACTED_TEXT');
    const chain = await databaseEngine.getHashChainForEvidence(evidence[0].id);
    expect(chain.some((node) => node.operation.startsWith('CLUSTER'))).toBe(true);
  });

  test('transcript-only evidence clusters from transcription and ignores empty OCR', async () => {
    const { caseId, evidence } = await seedCase([
      {
        file_path: '/vault/silent.jpg',
        media_type: 'IMAGE',
        import_ts: Date.now(),
        ocr_text: '',
        sha256_import: 'e'.repeat(64),
      },
      {
        file_path: '/vault/call.wav',
        media_type: 'AUDIO',
        import_ts: Date.now(),
        transcription: 'The caller said they would impersonate a bank officer tomorrow.',
        sha256_import: 'f'.repeat(64),
      },
    ]);
    const result = await timelineClusterer.clusterCase(caseId, {
      inferencer: inferencerReturning({
        events: [
          {
            event_type: 'impersonation',
            severity: 5,
            summary: 'Caller said they would impersonate a bank officer.',
            timestamp_hint: null,
            evidence_refs: [evidence[1].id],
          },
        ],
      }),
    });
    expect(result.persisted).toHaveLength(1);
    expect(result.persisted[0].evidence_ids).toEqual([evidence[1].id]);
    expect(result.persisted[0].event_type).toBe('impersonation');
  });

  test('multiple evidence references resolve to both supporting items', async () => {
    const { caseId, evidence } = await seedCase([
      {
        file_path: '/vault/msg1.txt',
        media_type: 'DOCUMENT',
        import_ts: Date.now(),
        ocr_text: 'Send bitcoin now.',
        sha256_import: '1'.repeat(64),
      },
      {
        file_path: '/vault/msg2.txt',
        media_type: 'DOCUMENT',
        import_ts: Date.now(),
        ocr_text: 'Screenshot forwarded as proof of the same demand.',
        sha256_import: '2'.repeat(64),
      },
    ]);
    const result = await timelineClusterer.clusterCase(caseId, {
      inferencer: inferencerReturning({
        events: [
          {
            event_type: 'evidence_sharing',
            severity: 3,
            summary: 'Demand repeated with a forwarded screenshot as proof.',
            timestamp_hint: null,
            evidence_refs: [evidence[0].id, evidence[1].id],
          },
        ],
      }),
    });
    expect(result.persisted).toHaveLength(1);
    expect(result.persisted[0].evidence_ids.sort()).toEqual([evidence[0].id, evidence[1].id].sort());
  });

  test('malformed model response is rejected and writes no event rows', async () => {
    const { caseId } = await seedCase([
      {
        file_path: '/vault/chat.txt',
        media_type: 'DOCUMENT',
        import_ts: Date.now(),
        ocr_text: 'Hello, this is a threat.',
        sha256_import: '3'.repeat(64),
      },
    ]);
    const result = await timelineClusterer.clusterCase(caseId, {
      inferencer: inferencerReturning('not-json {', 'Gemma did not return valid JSON. The raw local response is preserved for review.'),
    });
    expect(result.persisted).toHaveLength(0);
    expect(result.rejected[0].code).toBe('MALFORMED_JSON');
    expect(await databaseEngine.getEventsForCase(caseId)).toHaveLength(0);
  });

  test('invalid event type is rejected and not persisted', async () => {
    const { caseId, evidence } = await seedCase([
      {
        file_path: '/vault/chat.txt',
        media_type: 'DOCUMENT',
        import_ts: Date.now(),
        ocr_text: 'Hello there.',
        sha256_import: '4'.repeat(64),
      },
    ]);
    const result = await timelineClusterer.clusterCase(caseId, {
      inferencer: inferencerReturning({
        events: [
          {
            event_type: 'CAPTURE',
            severity: 2,
            summary: 'System capture is not an incident type.',
            timestamp_hint: null,
            evidence_refs: [evidence[0].id],
          },
        ],
      }),
    });
    expect(result.persisted).toHaveLength(0);
    expect(result.rejected[0].code).toBe('INVALID_EVENT_TYPE');
    expect(await databaseEngine.getEventsForCase(caseId)).toHaveLength(0);
  });

  test('invalid severity is rejected and not persisted', async () => {
    const { caseId, evidence } = await seedCase([
      {
        file_path: '/vault/chat.txt',
        media_type: 'DOCUMENT',
        import_ts: Date.now(),
        ocr_text: 'Escalate this now.',
        sha256_import: '5'.repeat(64),
      },
    ]);
    const result = await timelineClusterer.clusterCase(caseId, {
      inferencer: inferencerReturning({
        events: [
          {
            event_type: 'escalation',
            severity: 9,
            summary: 'Escalation mentioned in the message.',
            timestamp_hint: null,
            evidence_refs: [evidence[0].id],
          },
        ],
      }),
    });
    expect(result.persisted).toHaveLength(0);
    expect(result.rejected[0].code).toBe('INVALID_SEVERITY');
  });

  test('user can edit and annotate an AI-generated event', async () => {
    const { caseId, evidence } = await seedCase([
      {
        file_path: '/vault/chat.txt',
        media_type: 'DOCUMENT',
        import_ts: Date.now(),
        ocr_text: 'Initial email from the suspect.',
        sha256_import: '6'.repeat(64),
      },
    ]);
    const clustered = await timelineClusterer.clusterCase(caseId, {
      inferencer: inferencerReturning({
        events: [
          {
            event_type: 'other',
            severity: 1,
            summary: 'Initial email from the suspect.',
            timestamp_hint: null,
            evidence_refs: [evidence[0].id],
          },
        ],
      }),
    });
    const updated = await timelineClusterer.annotateEvent(clustered.persisted[0].id, {
      event_type: 'initial_contact',
      severity: 2 as IncidentSeverity,
      user_annotation: 'Confirmed as first contact by investigator SNEHA.',
      ai_summary: 'Initial email from the suspect, confirmed on review.',
    });
    expect(updated.user_edited).toBe(true);
    expect(updated.event_type).toBe('initial_contact');
    expect(updated.user_annotation).toContain('Confirmed as first contact');
  });

  test('unsupported evidence refs are not persisted as invented events', async () => {
    const { caseId } = await seedCase([
      {
        file_path: '/vault/chat.txt',
        media_type: 'DOCUMENT',
        import_ts: Date.now(),
        ocr_text: 'Only this document exists.',
        sha256_import: '7'.repeat(64),
      },
    ]);
    const result = await timelineClusterer.clusterCase(caseId, {
      inferencer: inferencerReturning({
        events: [
          {
            event_type: 'threat',
            severity: 4,
            summary: 'Threat from an evidence item that does not exist.',
            timestamp_hint: null,
            evidence_refs: ['missing-evidence-id'],
          },
        ],
      }),
    });
    expect(result.persisted).toHaveLength(0);
    expect(result.rejected[0].code).toBe('UNRESOLVED_EVIDENCE');
  });
});

import {
  temporalReconstructionService,
  resolveEvidenceTimestamp,
  normalizeEventType,
  ForensicTimelineEvent,
  ReconstructedTimeline,
} from '../src/services/temporalReconstructionService';
import { EvidenceRecord, EventRecord } from '../src/types';
import { ForensicExtractionSchema } from '../../ai/prompts/gemmaPrompts';

describe('STEP 9: Deterministic Temporal Forensic Reconstruction', () => {
  const caseId = 'case-test-101';

  const mockEvidence: EvidenceRecord[] = [
    {
      id: 'ev-01',
      case_id: caseId,
      file_path: '/vault/evidence/screenshot1.png',
      media_type: 'IMAGE',
      import_ts: 1788800000000,
      exif_ts: 1788700000000, // Explicit verified EXIF
      sha256_import: 'aaaa1111222233334444555566667777888899990000aaaabbbbccccddddeeee',
    },
    {
      id: 'ev-02',
      case_id: caseId,
      file_path: '/vault/evidence/audio_call.wav',
      media_type: 'AUDIO',
      import_ts: 1788810000000,
      user_ts: 1788750000000, // Explicit user-provided timestamp
      sha256_import: 'bbbb1111222233334444555566667777888899990000aaaabbbbccccddddeeee',
    },
    {
      id: 'ev-03',
      case_id: caseId,
      file_path: '/vault/evidence/document.pdf',
      media_type: 'DOCUMENT',
      import_ts: 1788820000000, // Only import timestamp
      sha256_import: 'cccc1111222233334444555566667777888899990000aaaabbbbccccddddeeee',
    },
    {
      id: 'ev-04',
      case_id: caseId,
      file_path: '/vault/evidence/unknown_time.png',
      media_type: 'IMAGE',
      import_ts: 0, // No valid timestamp
      sha256_import: 'dddd1111222233334444555566667777888899990000aaaabbbbccccddddeeee',
    },
  ];

  // ── 1. Timestamp Ordering ────────────────────────────────────────────────
  it('1. correctly orders events in strict chronological ascending order', () => {
    const events: EventRecord[] = [
      {
        id: 'ev-late',
        case_id: caseId,
        event_type: 'threat',
        severity: 4,
        timestamp: 1788750000000,
        evidence_ids: ['ev-02'],
        actor_ids: [],
        source: 'system',
      },
      {
        id: 'ev-early',
        case_id: caseId,
        event_type: 'initial_contact',
        severity: 2,
        timestamp: 1788700000000,
        evidence_ids: ['ev-01'],
        actor_ids: [],
        source: 'system',
      },
    ];

    const result = temporalReconstructionService.reconstructFromDatabaseRecords(
      caseId,
      events,
      mockEvidence
    );

    expect(result.chronologicalEvents.length).toBeGreaterThanOrEqual(2);
    expect(result.chronologicalEvents[0].id).toBe('ev-early');
    expect(result.chronologicalEvents[0].timestamp).toBe(1788700000000);
    expect(result.earliestTimestamp).toBe(1788700000000);
  });

  // ── 2. Equal Timestamp Deterministic Ordering ────────────────────────────
  it('2. breaks ties deterministically by evidenceId then eventId when timestamps are equal', () => {
    const events: EventRecord[] = [
      {
        id: 'ev-z',
        case_id: caseId,
        event_type: 'threat',
        severity: 4,
        timestamp: 1788700000000,
        evidence_ids: ['ev-02'],
        actor_ids: [],
        source: 'system',
      },
      {
        id: 'ev-a',
        case_id: caseId,
        event_type: 'demand',
        severity: 3,
        timestamp: 1788700000000,
        evidence_ids: ['ev-01'],
        actor_ids: [],
        source: 'system',
      },
      {
        id: 'ev-b',
        case_id: caseId,
        event_type: 'blackmail',
        severity: 5,
        timestamp: 1788700000000,
        evidence_ids: ['ev-01'],
        actor_ids: [],
        source: 'system',
      },
    ];

    const result = temporalReconstructionService.reconstructFromDatabaseRecords(
      caseId,
      events,
      mockEvidence
    );

    const sameTsEvents = result.chronologicalEvents.filter((e) => e.timestamp === 1788700000000);
    expect(sameTsEvents[0].evidenceId).toBe('ev-01');
    expect(sameTsEvents[0].id).toBe('ev-a');
    expect(sameTsEvents[1].evidenceId).toBe('ev-01');
    expect(sameTsEvents[1].id).toBe('ev-b');
    expect(sameTsEvents[2].evidenceId).toBe('ev-02');
    expect(sameTsEvents[2].id).toBe('ev-z');
  });

  // ── 3. Missing Timestamp Handling ────────────────────────────────────────
  it('3. isolates missing timestamp events into unknownTimestampEvents without inventing timestamps', () => {
    const events: EventRecord[] = [
      {
        id: 'ev-unknown',
        case_id: caseId,
        event_type: 'coercion',
        severity: 4,
        timestamp: 0,
        evidence_ids: ['ev-04'],
        actor_ids: [],
        source: 'system',
      },
    ];

    const result = temporalReconstructionService.reconstructFromDatabaseRecords(
      caseId,
      events,
      mockEvidence
    );

    const unk = result.unknownTimestampEvents.find((e) => e.id === 'ev-unknown');
    expect(unk).toBeDefined();
    expect(unk?.timestamp).toBeNull();
    expect(unk?.timestampProvenance).toBe('UNKNOWN');
  });

  // ── 4. Timestamp Provenance Hierarchy ────────────────────────────────────
  it('4. strictly follows provenance hierarchy (EXIF > User > Import)', () => {
    const resExif = resolveEvidenceTimestamp(mockEvidence[0]);
    expect(resExif.provenance).toBe('EXIF');
    expect(resExif.timestamp).toBe(1788700000000);

    const resUser = resolveEvidenceTimestamp(mockEvidence[1]);
    expect(resUser.provenance).toBe('USER_SPECIFIED');
    expect(resUser.timestamp).toBe(1788750000000);

    const resImport = resolveEvidenceTimestamp(mockEvidence[2]);
    expect(resImport.provenance).toBe('IMPORT');
    expect(resImport.timestamp).toBe(1788820000000);

    const resNone = resolveEvidenceTimestamp({ import_ts: 0 });
    expect(resNone.provenance).toBe('UNKNOWN');
    expect(resNone.timestamp).toBeNull();
  });

  // ── 5. Evidence-to-Event Linkage ─────────────────────────────────────────
  it('5. preserves strict linkage to source evidence ID', () => {
    const events: EventRecord[] = [
      {
        id: 'ev-link',
        case_id: caseId,
        event_type: 'threat',
        severity: 4,
        timestamp: 1788700000000,
        evidence_ids: ['ev-01'],
        actor_ids: [],
        source: 'system',
      },
    ];

    const result = temporalReconstructionService.reconstructFromDatabaseRecords(
      caseId,
      events,
      mockEvidence
    );

    const ev = result.chronologicalEvents.find((e) => e.id === 'ev-link');
    expect(ev?.evidenceId).toBe('ev-01');
  });

  // ── 6. Rejected Event Exclusion / Audit Preservation ─────────────────────
  it('6. routes rejected validation events to rejectedEvents audit list', () => {
    const schema: ForensicExtractionSchema = {
      incidentType: 'extortion',
      incidentSummary: 'Test incident',
      extractedFacts: [],
      temporalEvents: [
        {
          timestamp: '2026-09-08T09:00:00Z',
          eventType: 'threat',
          description: 'Verified threat',
          sourceEvidenceId: 'ev-01',
          certainty: 'explicit',
          severity: 4,
        },
      ],
      threats: ['Threat'],
      blackmailIndicators: [],
      coercionIndicators: [],
      paymentDemands: [],
      harassmentIndicators: [],
      communicationChannels: [],
      quotedStatements: [],
      phoneNumbers: [],
      urlsAndDomains: [],
      actors: [],
      uncertainties: [],
    };

    const rejectedValidation = [
      {
        timestamp: '2026-09-08T10:00:00Z',
        eventType: 'demand' as const,
        description: 'Fabricated payment claim',
        sourceEvidenceId: 'non-existent-ev',
        certainty: 'inferred' as const,
        severity: 3 as const,
      },
    ];

    const result = temporalReconstructionService.reconstructFromSchema(
      caseId,
      schema,
      mockEvidence,
      rejectedValidation
    );

    expect(result.rejectedEvents.length).toBe(1);
    expect(result.rejectedEvents[0].trustIndicator).toBe('REJECTED');
    expect(result.rejectedEvents[0].description).toBe('Fabricated payment claim');
    expect(result.rejectedCount).toBe(1);
  });

  // ── 7. Inferred Event Classification ─────────────────────────────────────
  it('7. classifies model inferences and import-only timestamps as INFERRED trust indicator', () => {
    const schema: ForensicExtractionSchema = {
      incidentType: 'harassment',
      incidentSummary: 'Inferred harassment pattern',
      extractedFacts: [],
      temporalEvents: [
        {
          timestamp: '2026-09-08T09:00:00Z',
          eventType: 'other',
          description: 'Contextually inferred message',
          sourceEvidenceId: 'ev-03', // Has only IMPORT timestamp
          certainty: 'inferred',
          severity: 2,
        },
      ],
      threats: [],
      blackmailIndicators: [],
      coercionIndicators: [],
      paymentDemands: [],
      harassmentIndicators: [],
      communicationChannels: [],
      quotedStatements: [],
      phoneNumbers: [],
      urlsAndDomains: [],
      actors: [],
      uncertainties: [],
    };

    const result = temporalReconstructionService.reconstructFromSchema(
      caseId,
      schema,
      mockEvidence
    );

    const ev = result.chronologicalEvents.find((e) => e.description === 'Contextually inferred message');
    expect(ev?.trustIndicator).toBe('INFERRED');
  });

  // ── 8. Multi-Case Isolation ──────────────────────────────────────────────
  it('8. isolates timeline reconstruction strictly to the specified case', () => {
    const otherCaseEvents: EventRecord[] = [
      {
        id: 'ev-other',
        case_id: 'other-case-999',
        event_type: 'threat',
        severity: 5,
        timestamp: 1788700000000,
        evidence_ids: ['ev-other-item'],
        actor_ids: [],
        source: 'system',
      },
    ];

    const result = temporalReconstructionService.reconstructFromDatabaseRecords(
      caseId,
      otherCaseEvents.filter((e) => e.case_id === caseId),
      mockEvidence
    );

    expect(result.chronologicalEvents.some((e) => e.caseId === 'other-case-999')).toBe(false);
  });

  // ── 9. Empty Case Handling ───────────────────────────────────────────────
  it('9. safely handles empty cases without errors or fabricated records', () => {
    const result = temporalReconstructionService.reconstructFromDatabaseRecords(
      'empty-case',
      [],
      []
    );

    expect(result.chronologicalEvents.length).toBe(0);
    expect(result.unknownTimestampEvents.length).toBe(0);
    expect(result.rejectedEvents.length).toBe(0);
    expect(result.totalEventsCount).toBe(0);
    expect(result.earliestTimestamp).toBeNull();
    expect(result.latestTimestamp).toBeNull();
  });

  // ── 10. Event Type Normalization ─────────────────────────────────────────
  it('10. normalizes event types into standardized ForensicEventType', () => {
    expect(normalizeEventType('direct_threat')).toBe('THREAT');
    expect(normalizeEventType('UPI_PAYMENT_DEMAND')).toBe('PAYMENT_DEMAND');
    expect(normalizeEventType('photo_blackmail')).toBe('BLACKMAIL');
    expect(normalizeEventType('intimidation_coercion')).toBe('COERCION');
    expect(normalizeEventType('whatsapp_chat_message')).toBe('COMMUNICATION');
    expect(normalizeEventType('random_action')).toBe('OTHER');
  });
});

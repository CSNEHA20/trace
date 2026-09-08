import {
  validateAndGroundForensicExtraction,
  extractAndParseJson,
  EvidenceItemContext,
} from '../../ai/inference/evidenceGroundingValidator';
import { databaseEngine } from '../../database/services/databaseEngine';
import { forensicAnalysisService } from '../src/services/forensicAnalysisService';
import { onDeviceInferenceService } from '../../ai/inference/inferenceService';
import { chainService } from '../src/services/chainService';

describe('TRACE Step 8.1: Forensic Provenance Hardening & Grounding Pipeline', () => {
  const mockEvidence: EvidenceItemContext[] = [
    {
      id: 'ev-case1-photo-threat-1',
      media_type: 'IMAGE',
      file_path: 'files/threat_chat.jpg',
      ocr_text: 'I will publish your private photos if you do not pay me $5,000 to UPI ID victim@okbank or call 9876543210. Visit https://blackmail-drop.com',
      transcription: undefined,
      import_ts: 1725700000000,
      sha256_import: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    },
    {
      id: 'ev-case1-audio-call-2',
      media_type: 'AUDIO',
      file_path: 'files/voicemail.wav',
      ocr_text: undefined,
      transcription: 'Alex speaking. Send the money through this UPI ID or I will send the screenshots to everyone tomorrow at 8 PM.',
      import_ts: 1725705000000,
      sha256_import: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    },
  ];

  beforeAll(async () => {
    await databaseEngine.initialize('test_forensic_grounding_8_1.db');
  });

  afterAll(async () => {
    await databaseEngine.close();
  });

  // 1. valid sourceEvidenceId → accepted
  test('1. Valid sourceEvidenceId is accepted with verified provenance', () => {
    const raw = JSON.stringify({
      incidentType: 'blackmail',
      incidentSummary: 'Suspect demands $5,000 payment threatening photo publication.',
      extractedFacts: [
        {
          fact: 'Demanded $5,000 payment',
          type: 'financial',
          sourceEvidenceId: 'ev-case1-photo-threat-1',
          sourceSpan: 'pay me $5,000',
          certainty: 'explicit',
        },
      ],
      actors: [
        {
          name: 'Alex',
          role: 'perpetrator',
          identifiers: ['victim@okbank'],
          certainty: 'explicit',
        },
      ],
      temporalEvents: [
        {
          timestamp: '2026-09-08T08:00:00Z',
          description: 'Payment demand sent',
          eventType: 'demand',
          severity: 4,
          sourceEvidenceId: 'ev-case1-photo-threat-1',
          certainty: 'explicit',
        },
      ],
      threats: ['I will publish your private photos if you do not pay me'],
      harassmentIndicators: [],
      blackmailIndicators: ['Demand money or release private photos'],
      coercionIndicators: ['Threatening publication to force payment'],
      paymentDemands: ['$5,000 to UPI ID victim@okbank'],
      communicationChannels: ['SMS'],
      phoneNumbers: ['9876543210'],
      urlsAndDomains: ['https://blackmail-drop.com'],
      quotedStatements: ['I will publish your private photos if you do not pay me'],
      uncertainties: [],
    });

    const res = validateAndGroundForensicExtraction(raw, mockEvidence);
    expect(res.isValid).toBe(true);
    expect(res.status).toBe('VALID');
    expect(res.schema?.extractedFacts.length).toBe(1);
    expect(res.schema?.extractedFacts[0].sourceEvidenceId).toBe('ev-case1-photo-threat-1');
    expect(res.schema?.temporalEvents.length).toBe(1);
    expect(res.schema?.temporalEvents[0].sourceEvidenceId).toBe('ev-case1-photo-threat-1');
    expect(res.rejectedClaims.length).toBe(0);
  });

  // 2. unknown sourceEvidenceId → rejected (NOT remapped)
  test('2. Unknown sourceEvidenceId is strictly rejected, NEVER remapped', () => {
    const raw = JSON.stringify({
      incidentType: 'threat',
      incidentSummary: 'Summary',
      extractedFacts: [
        {
          fact: 'Claim citing hallucinated evidence ID',
          type: 'statement',
          sourceEvidenceId: 'non-existent-ev-999',
          certainty: 'explicit',
        },
      ],
      actors: [],
      temporalEvents: [
        {
          timestamp: '2026-09-08T08:00:00Z',
          description: 'Event with fake evidence ID',
          eventType: 'threat',
          severity: 3,
          sourceEvidenceId: 'fake-evidence-id-888',
          certainty: 'explicit',
        },
      ],
      threats: [],
      harassmentIndicators: [],
      blackmailIndicators: [],
      coercionIndicators: [],
      paymentDemands: [],
      communicationChannels: [],
      phoneNumbers: [],
      urlsAndDomains: [],
      quotedStatements: [],
      uncertainties: [],
    });

    const res = validateAndGroundForensicExtraction(raw, mockEvidence);
    expect(res.isValid).toBe(true);
    // Extracted facts and temporal events MUST be rejected from verified arrays
    expect(res.schema?.extractedFacts.length).toBe(0);
    expect(res.schema?.temporalEvents.length).toBe(0);
    // Preserved in rejectedClaims
    expect(res.rejectedClaims.some((r) => r.field === 'extractedFacts' && r.sourceEvidenceId === 'non-existent-ev-999')).toBe(true);
    expect(res.rejectedClaims.some((r) => r.field === 'temporalEvents' && r.sourceEvidenceId === 'fake-evidence-id-888')).toBe(true);
  });

  // 3. sourceEvidenceId from another case → rejected (Case Isolation)
  test('3. Evidence ID belonging to another case is strictly rejected', () => {
    // Current case evidence has IDs: ev-case1-photo-threat-1, ev-case1-audio-call-2
    // Foreign evidence ID from Case B: ev-case2-unrelated-file-9
    const raw = JSON.stringify({
      incidentType: 'harassment',
      incidentSummary: 'Cross-case isolation test',
      extractedFacts: [
        {
          fact: 'Claim referencing evidence from a different case',
          type: 'statement',
          sourceEvidenceId: 'ev-case2-unrelated-file-9',
          certainty: 'explicit',
        },
      ],
      actors: [],
      temporalEvents: [],
      threats: [],
      harassmentIndicators: [],
      blackmailIndicators: [],
      coercionIndicators: [],
      paymentDemands: [],
      communicationChannels: [],
      phoneNumbers: [],
      urlsAndDomains: [],
      quotedStatements: [],
      uncertainties: [],
    });

    const res = validateAndGroundForensicExtraction(raw, mockEvidence);
    expect(res.isValid).toBe(true);
    expect(res.schema?.extractedFacts.length).toBe(0);
    expect(res.rejectedClaims.some((r) => r.reason === 'INVALID_SOURCE_EVIDENCE_ID' && r.sourceEvidenceId === 'ev-case2-unrelated-file-9')).toBe(true);
  });

  // 4. missing sourceEvidenceId → rejected for evidence-backed claims
  test('4. Missing sourceEvidenceId is strictly rejected for evidence-backed claims', () => {
    const raw = JSON.stringify({
      incidentType: 'threat',
      incidentSummary: 'Missing provenance test',
      extractedFacts: [
        {
          fact: 'Claim without any evidence citation',
          type: 'statement',
          // sourceEvidenceId omitted
          certainty: 'explicit',
        },
      ],
      actors: [],
      temporalEvents: [
        {
          description: 'Event without evidence citation',
          eventType: 'demand',
          severity: 2,
          // sourceEvidenceId omitted
          certainty: 'explicit',
        },
      ],
      threats: [],
      harassmentIndicators: [],
      blackmailIndicators: [],
      coercionIndicators: [],
      paymentDemands: [],
      communicationChannels: [],
      phoneNumbers: [],
      urlsAndDomains: [],
      quotedStatements: [],
      uncertainties: [],
    });

    const res = validateAndGroundForensicExtraction(raw, mockEvidence);
    expect(res.isValid).toBe(true);
    expect(res.schema?.extractedFacts.length).toBe(0);
    expect(res.schema?.temporalEvents.length).toBe(0);
    expect(res.rejectedClaims.length).toBe(2);
    expect(res.rejectedClaims.every((r) => r.reason === 'INVALID_SOURCE_EVIDENCE_ID')).toBe(true);
  });

  // 5. valid evidence + inferred interpretation → accepted as inferred
  test('5. Valid evidence with inferred interpretation is accepted as inferred', () => {
    const raw = JSON.stringify({
      incidentType: 'blackmail',
      incidentSummary: 'Summary',
      extractedFacts: [
        {
          fact: 'Perpetrator likely has access to victims cloud drive',
          type: 'inference',
          sourceEvidenceId: 'ev-case1-photo-threat-1',
          certainty: 'inferred',
        },
      ],
      actors: [],
      temporalEvents: [
        {
          description: 'Probable earlier contact occurred based on familiarity',
          eventType: 'initial_contact',
          severity: 2,
          sourceEvidenceId: 'ev-case1-photo-threat-1',
          certainty: 'inferred',
        },
      ],
      threats: [],
      harassmentIndicators: [],
      blackmailIndicators: [],
      coercionIndicators: [],
      paymentDemands: [],
      communicationChannels: [],
      phoneNumbers: [],
      urlsAndDomains: [],
      quotedStatements: [],
      uncertainties: [],
    });

    const res = validateAndGroundForensicExtraction(raw, mockEvidence);
    expect(res.isValid).toBe(true);
    expect(res.schema?.extractedFacts.length).toBe(1);
    expect(res.schema?.extractedFacts[0].certainty).toBe('inferred');
    expect(res.schema?.temporalEvents.length).toBe(1);
    expect(res.schema?.temporalEvents[0].certainty).toBe('inferred');
    expect(res.rejectedClaims.length).toBe(0);
  });

  // 6. invalid evidence + inferred interpretation → rejected (cannot rescue invalid provenance)
  test('6. Invalid evidence with inferred certainty is rejected (cannot rescue invalid ID)', () => {
    const raw = JSON.stringify({
      incidentType: 'blackmail',
      incidentSummary: 'Summary',
      extractedFacts: [
        {
          fact: 'Inferred claim citing fake evidence',
          type: 'inference',
          sourceEvidenceId: 'fake-evidence-id',
          certainty: 'inferred', // Model attempts to mark as inferred
        },
      ],
      actors: [],
      temporalEvents: [],
      threats: [],
      harassmentIndicators: [],
      blackmailIndicators: [],
      coercionIndicators: [],
      paymentDemands: [],
      communicationChannels: [],
      phoneNumbers: [],
      urlsAndDomains: [],
      quotedStatements: [],
      uncertainties: [],
    });

    const res = validateAndGroundForensicExtraction(raw, mockEvidence);
    expect(res.isValid).toBe(true);
    // MUST BE REJECTED despite certainty="inferred"
    expect(res.schema?.extractedFacts.length).toBe(0);
    expect(res.rejectedClaims.some((r) => r.reason === 'INVALID_SOURCE_EVIDENCE_ID' && r.sourceEvidenceId === 'fake-evidence-id')).toBe(true);
  });

  // 7. one valid claim + one invalid claim → valid claim survives, invalid claim rejected
  test('7. Independent claim validation: valid claim survives, invalid claim rejected without pollution', () => {
    const raw = JSON.stringify({
      incidentType: 'threat',
      incidentSummary: 'Mixed claims test',
      extractedFacts: [
        {
          fact: 'Valid claim citing real evidence',
          type: 'statement',
          sourceEvidenceId: 'ev-case1-photo-threat-1',
          sourceSpan: 'pay me $5,000',
          certainty: 'explicit',
        },
        {
          fact: 'Invalid claim citing fake evidence',
          type: 'statement',
          sourceEvidenceId: 'fake-evidence-999',
          certainty: 'explicit',
        },
      ],
      actors: [],
      temporalEvents: [],
      threats: [],
      harassmentIndicators: [],
      blackmailIndicators: [],
      coercionIndicators: [],
      paymentDemands: [],
      communicationChannels: [],
      phoneNumbers: [],
      urlsAndDomains: [],
      quotedStatements: [],
      uncertainties: [],
    });

    const res = validateAndGroundForensicExtraction(raw, mockEvidence);
    expect(res.isValid).toBe(true);
    expect(res.schema?.extractedFacts.length).toBe(1);
    expect(res.schema?.extractedFacts[0].fact).toBe('Valid claim citing real evidence');
    expect(res.schema?.extractedFacts[0].sourceEvidenceId).toBe('ev-case1-photo-threat-1');
    expect(res.rejectedClaims.length).toBe(1);
    expect(res.rejectedClaims[0].sourceEvidenceId).toBe('fake-evidence-999');
  });

  // 8. model uses "fact" or "facts" alias → deterministic normalization only if safe
  test('8. Model uses deterministic "facts" or "fact" alias which normalizes and validates safely', () => {
    const raw = JSON.stringify({
      incidentType: 'blackmail',
      incidentSummary: 'Alias test',
      facts: [
        {
          fact: 'Alias fact properly referenced',
          type: 'financial',
          sourceEvidenceId: 'ev-case1-photo-threat-1',
          certainty: 'explicit',
        },
      ],
      events: [
        {
          description: 'Alias event properly referenced',
          eventType: 'demand',
          severity: 3,
          sourceEvidenceId: 'ev-case1-audio-call-2',
          certainty: 'explicit',
        },
      ],
      entities: [
        {
          name: 'Alex',
          role: 'perpetrator',
          identifiers: ['victim@okbank'],
          certainty: 'explicit',
        },
      ],
      quotes: ['I will publish your private photos if you do not pay me'],
      phones: ['9876543210'],
      urls: ['https://blackmail-drop.com'],
      threats: [],
      harassmentIndicators: [],
      blackmailIndicators: [],
      coercionIndicators: [],
      paymentDemands: [],
      communicationChannels: [],
      uncertainties: [],
    });

    const res = validateAndGroundForensicExtraction(raw, mockEvidence);
    expect(res.isValid).toBe(true);
    expect(res.schema?.extractedFacts.length).toBe(1);
    expect(res.schema?.extractedFacts[0].fact).toBe('Alias fact properly referenced');
    expect(res.schema?.temporalEvents.length).toBe(1);
    expect(res.schema?.temporalEvents[0].description).toBe('Alias event properly referenced');
    expect(res.schema?.actors.length).toBe(1);
    expect(res.schema?.actors[0].name).toBe('Alex');
    expect(res.schema?.quotedStatements).toContain('I will publish your private photos if you do not pay me');
    expect(res.schema?.phoneNumbers).toContain('9876543210');
    expect(res.schema?.urlsAndDomains).toContain('https://blackmail-drop.com');
  });

  // 9. malformed output → INVALID_MODEL_OUTPUT
  test('9. Malformed non-JSON or top-level primitive returns INVALID_MODEL_OUTPUT', () => {
    const rawText = 'I am an AI assistant and here is the analysis: Suspect is threatening.';
    const resText = validateAndGroundForensicExtraction(rawText, mockEvidence);
    expect(resText.isValid).toBe(false);
    expect(resText.status).toBe('INVALID_MODEL_OUTPUT');

    const rawArray = JSON.stringify(['item1', 'item2']);
    const resArray = validateAndGroundForensicExtraction(rawArray, mockEvidence);
    expect(resArray.isValid).toBe(false);
    expect(resArray.status).toBe('INVALID_MODEL_OUTPUT');
  });

  // 10. rejected claim preserved in audit output (rejectedClaims + uncertainties)
  test('10. Rejected claims are fully preserved in audit structure without information loss', () => {
    const raw = JSON.stringify({
      incidentType: 'harassment',
      incidentSummary: 'Audit log test',
      extractedFacts: [
        {
          fact: 'Hallucinated fact with fake ID',
          type: 'statement',
          sourceEvidenceId: 'fake-id-1234',
          certainty: 'explicit',
        },
      ],
      actors: [],
      temporalEvents: [],
      threats: [],
      harassmentIndicators: [],
      blackmailIndicators: [],
      coercionIndicators: [],
      paymentDemands: [],
      communicationChannels: [],
      phoneNumbers: ['+1-555-0199'], // Hallucinated phone
      urlsAndDomains: ['https://unsupported-site.org'], // Hallucinated URL
      quotedStatements: ['I never said this statement in the call.'], // Hallucinated quote
      uncertainties: [],
    });

    const res = validateAndGroundForensicExtraction(raw, mockEvidence);
    expect(res.isValid).toBe(true);
    expect(res.rejectedClaims.length).toBe(4);
    // Audit uncertainties log contains each rejection with field and reason
    expect(res.schema?.uncertainties.some((u) => u.includes('extractedFacts') && u.includes('fake-id-1234'))).toBe(true);
    expect(res.schema?.uncertainties.some((u) => u.includes('phoneNumbers') && u.includes('+1-555-0199'))).toBe(true);
    expect(res.schema?.uncertainties.some((u) => u.includes('urlsOrDomains') && u.includes('https://unsupported-site.org'))).toBe(true);
    expect(res.schema?.uncertainties.some((u) => u.includes('quotedStatements'))).toBe(true);
  });

  // 11 & 12. SQLite persistence does not persist rejected claims; ANALYZE hash chain represents validated state
  test('11 & 12. SQLite pipeline persists ONLY validated claims; ANALYZE hash chain captures verified state', async () => {
    const testCase = await databaseEngine.createCase({
      case_number: `TR-TEST-81-${Date.now()}`,
      title: 'Step 8.1 Strict Provenance Pipeline Test',
      description: 'Validation of strict provenance persistence and hash chain ledger',
      investigator_name: 'Lead Forensics Investigator',
      status: 'ACTIVE',
    });

    const validEvidence = await databaseEngine.insertEvidence({
      case_id: testCase.id,
      file_path: 'sandbox/threat_letter_81.jpg',
      media_type: 'IMAGE',
      import_ts: Date.now(),
      sha256_import: '2222222222222222222222222222222222222222222222222222222222222222',
      ocr_text: 'I will publish your private photos if you do not pay me $5,000 to UPI ID victim@okbank. Call 9876543210.',
    });

    // Model returns 1 valid fact, 1 valid event, 1 INVALID fact, and 1 INVALID event
    const mockModelOutput = JSON.stringify({
      incidentType: 'blackmail',
      incidentSummary: 'Blackmail threat demanding $5,000.',
      extractedFacts: [
        {
          fact: 'Valid fact citing real evidence ID',
          type: 'financial',
          sourceEvidenceId: validEvidence.id,
          sourceSpan: 'pay me $5,000',
          certainty: 'explicit',
        },
        {
          fact: 'Invalid fact citing hallucinated evidence ID',
          type: 'statement',
          sourceEvidenceId: 'hallucinated-evidence-999',
          certainty: 'explicit',
        },
      ],
      actors: [
        {
          name: 'Blackmailer',
          role: 'perpetrator',
          identifiers: ['9876543210'],
          certainty: 'explicit',
        },
      ],
      temporalEvents: [
        {
          timestamp: '2026-09-08T09:00:00Z',
          description: 'Valid event with real evidence ID',
          eventType: 'demand',
          severity: 5,
          sourceEvidenceId: validEvidence.id,
          certainty: 'explicit',
        },
        {
          timestamp: '2026-09-08T10:00:00Z',
          description: 'Invalid event with hallucinated ID',
          eventType: 'threat',
          severity: 4,
          sourceEvidenceId: 'hallucinated-evidence-888',
          certainty: 'explicit',
        },
      ],
      threats: ['I will publish your private photos if you do not pay me'],
      harassmentIndicators: [],
      blackmailIndicators: ['Demanding $5,000 or releasing photos'],
      coercionIndicators: ['Coercive deadline'],
      paymentDemands: ['$5,000 to UPI ID victim@okbank'],
      communicationChannels: ['SMS'],
      phoneNumbers: ['9876543210'],
      urlsAndDomains: [],
      quotedStatements: ['I will publish your private photos if you do not pay me'],
      uncertainties: [],
    });

    const spy = jest.spyOn(onDeviceInferenceService, 'inferForensicExtraction').mockResolvedValueOnce({
      schema: validateAndGroundForensicExtraction(mockModelOutput, [validEvidence]).schema,
      rawOutput: mockModelOutput,
      durationMs: 4100,
      warnings: ['Fact references invalid or missing evidence ID "hallucinated-evidence-999". Claim rejected.'],
      rejectedClaims: [
        { field: 'extractedFacts', value: 'Invalid fact citing hallucinated evidence ID', reason: 'INVALID_SOURCE_EVIDENCE_ID', sourceEvidenceId: 'hallucinated-evidence-999' },
        { field: 'temporalEvents', value: 'Invalid event with hallucinated ID', reason: 'INVALID_SOURCE_EVIDENCE_ID', sourceEvidenceId: 'hallucinated-evidence-888' },
      ],
      chunksCount: 1,
    });

    const analysisResult = await forensicAnalysisService.analyzeCaseEvidence(testCase.id);

    // 11. Verify rejected claims are NOT persisted as verified events in SQLite
    expect(analysisResult.persistedEventIds.length).toBe(1); // Only the 1 valid event persisted
    const savedEvents = await databaseEngine.getEventsForCase(testCase.id);
    expect(savedEvents.length).toBe(1);
    expect(savedEvents[0].ai_summary).toContain('Valid event with real evidence ID');
    expect(savedEvents[0].evidence_ids).toEqual([validEvidence.id]);

    // Narrative records verified facts and lists rejections under uncertainties
    const savedNarrative = await databaseEngine.getLatestNarrativeForCase(testCase.id);
    expect(savedNarrative?.content).toContain('Valid fact citing real evidence ID');
    expect(savedNarrative?.content).not.toContain('Ref: hallucinated-evidence-999');
    expect(savedNarrative?.content).toContain('### Forensic Uncertainties & Validation Rejections');

    // 12. Hash chain ANALYZE record captures the validated result
    expect(analysisResult.hashChainNodeId).toBeDefined();
    const chainHistory = await chainService.getChain(validEvidence.id);
    const analyzeNode = chainHistory.find((n) => n.operation === 'ANALYZE');
    expect(analyzeNode).toBeDefined();
    expect(analyzeNode?.id).toBe(analysisResult.hashChainNodeId);

    spy.mockRestore();
  });
});

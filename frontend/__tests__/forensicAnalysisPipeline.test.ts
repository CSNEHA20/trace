import {
  validateAndGroundForensicExtraction,
  extractAndParseJson,
  EvidenceItemContext,
} from '../../ai/inference/evidenceGroundingValidator';
import { databaseEngine } from '../../database/services/databaseEngine';
import { forensicAnalysisService } from '../src/services/forensicAnalysisService';
import { onDeviceInferenceService } from '../../ai/inference/inferenceService';
import { chainService } from '../src/services/chainService';

describe('TRACE Step 8: Forensic Analysis Grounding & Validation Pipeline', () => {
  const mockEvidence: EvidenceItemContext[] = [
    {
      id: 'ev-photo-threat-1',
      media_type: 'IMAGE',
      file_path: 'files/threat_chat.jpg',
      ocr_text: 'I will publish your private photos if you do not pay me $5,000 to UPI ID victim@okbank or call 9876543210. Visit https://blackmail-drop.com',
      transcription: undefined,
      import_ts: 1725700000000,
      sha256_import: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    },
    {
      id: 'ev-audio-call-2',
      media_type: 'AUDIO',
      file_path: 'files/voicemail.wav',
      ocr_text: undefined,
      transcription: 'Alex speaking. Send the money through this UPI ID or I will send the screenshots to everyone tomorrow at 8 PM.',
      import_ts: 1725705000000,
      sha256_import: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    },
  ];

  beforeAll(async () => {
    await databaseEngine.initialize('test_forensic_grounding.db');
  });

  afterAll(async () => {
    await databaseEngine.close();
  });

  // A. Valid JSON output
  test('A. Valid JSON model output parses and grounds correctly', () => {
    const raw = JSON.stringify({
      incidentType: 'blackmail',
      incidentSummary: 'Suspect demands $5,000 payment threatening photo publication.',
      extractedFacts: [
        {
          fact: 'Demanded $5,000 payment',
          type: 'financial',
          sourceEvidenceId: 'ev-photo-threat-1',
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
          sourceEvidenceId: 'ev-photo-threat-1',
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
    expect(res.schema?.incidentType).toBe('blackmail');
    expect(res.schema?.phoneNumbers).toContain('9876543210');
    expect(res.schema?.urlsAndDomains).toContain('https://blackmail-drop.com');
    expect(res.schema?.quotedStatements.length).toBe(1);
    expect(res.schema?.actors[0].name).toBe('Alex');
  });

  // B. Model output with surrounding explanation
  test('B. Model output with surrounding conversational explanation is extracted and parsed', () => {
    const raw = `Here is the requested JSON forensic analysis:
\`\`\`json
{
  "incidentType": "threat",
  "incidentSummary": "Threat to publish photos if payment not received",
  "extractedFacts": [
    {
      "fact": "Threat to distribute private images",
      "type": "statement",
      "sourceEvidenceId": "ev-photo-threat-1",
      "certainty": "explicit"
    }
  ],
  "actors": [],
  "temporalEvents": [],
  "threats": ["I will publish your private photos"],
  "harassmentIndicators": [],
  "blackmailIndicators": [],
  "coercionIndicators": [],
  "paymentDemands": [],
  "communicationChannels": [],
  "phoneNumbers": [],
  "urlsAndDomains": [],
  "quotedStatements": ["I will publish your private photos"],
  "uncertainties": []
}
\`\`\`
I hope this structured extraction is helpful for TRACE investigation.`;

    const res = validateAndGroundForensicExtraction(raw, mockEvidence);
    expect(res.isValid).toBe(true);
    expect(res.schema?.incidentType).toBe('threat');
    expect(res.schema?.extractedFacts.length).toBe(1);
  });

  // C. Malformed JSON
  test('C. Malformed JSON output is rejected with INVALID_MODEL_OUTPUT', () => {
    const raw = 'This is plain natural language output with no JSON braces or keys.';
    const res = validateAndGroundForensicExtraction(raw, mockEvidence);
    expect(res.isValid).toBe(false);
    expect(res.status).toBe('INVALID_MODEL_OUTPUT');
    expect(res.parseError).toBeDefined();
    expect(res.rawOutput).toBe(raw);
  });

  // D. Unsupported Evidence ID
  test('D. Fact referencing unsupported/hallucinated evidence ID is remapped with warning', () => {
    const raw = JSON.stringify({
      incidentType: 'threat',
      incidentSummary: 'Summary',
      extractedFacts: [
        {
          fact: 'Claim citing non-existent evidence',
          type: 'statement',
          sourceEvidenceId: 'non-existent-ev-999',
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
    expect(res.warnings.some((w) => w.includes('non-existent-ev-999'))).toBe(true);
    expect(res.rejectedClaims.some((r) => r.field === 'extractedFacts.sourceEvidenceId')).toBe(true);
    expect(res.schema?.extractedFacts[0].sourceEvidenceId).toBe('ev-photo-threat-1');
  });

  // E. Unsupported Actor
  test('E. Actor name not present anywhere in evidence is rejected from explicit actors', () => {
    const raw = JSON.stringify({
      incidentType: 'threat',
      incidentSummary: 'Summary',
      extractedFacts: [],
      actors: [
        {
          name: 'Vladimir Markov', // Hallucinated name not in evidence
          role: 'perpetrator',
          identifiers: [],
          certainty: 'explicit',
        },
      ],
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
    expect(res.warnings.some((w) => w.includes('Vladimir Markov'))).toBe(true);
    expect(res.rejectedClaims.some((r) => r.field === 'actors.name')).toBe(true);
    expect(res.schema?.actors[0].certainty).toBe('inferred');
  });

  // F. Unsupported Phone Number
  test('F. Hallucinated phone number not in evidence is rejected and recorded', () => {
    const raw = JSON.stringify({
      incidentType: 'harassment',
      incidentSummary: 'Summary',
      extractedFacts: [],
      actors: [],
      temporalEvents: [],
      threats: [],
      harassmentIndicators: [],
      blackmailIndicators: [],
      coercionIndicators: [],
      paymentDemands: [],
      communicationChannels: [],
      phoneNumbers: ['+1-555-0199'], // Not in evidence
      urlsAndDomains: [],
      quotedStatements: [],
      uncertainties: [],
    });

    const res = validateAndGroundForensicExtraction(raw, mockEvidence);
    expect(res.isValid).toBe(true);
    expect(res.schema?.phoneNumbers.length).toBe(0);
    expect(res.rejectedClaims.some((r) => r.field === 'phoneNumbers' && r.value === '+1-555-0199')).toBe(true);
  });

  // G. Unsupported URL
  test('G. Hallucinated URL not in evidence is rejected and recorded', () => {
    const raw = JSON.stringify({
      incidentType: 'blackmail',
      incidentSummary: 'Summary',
      extractedFacts: [],
      actors: [],
      temporalEvents: [],
      threats: [],
      harassmentIndicators: [],
      blackmailIndicators: [],
      coercionIndicators: [],
      paymentDemands: [],
      communicationChannels: [],
      phoneNumbers: [],
      urlsAndDomains: ['https://fake-scam-site.org'], // Not in evidence
      quotedStatements: [],
      uncertainties: [],
    });

    const res = validateAndGroundForensicExtraction(raw, mockEvidence);
    expect(res.isValid).toBe(true);
    expect(res.schema?.urlsAndDomains.length).toBe(0);
    expect(res.rejectedClaims.some((r) => r.field === 'urlsOrDomains' && r.value === 'https://fake-scam-site.org')).toBe(true);
  });

  // H. Unsupported Quote
  test('H. Quoted statement not occurring verbatim in evidence is rejected', () => {
    const raw = JSON.stringify({
      incidentType: 'blackmail',
      incidentSummary: 'Summary',
      extractedFacts: [],
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
      quotedStatements: ['I have already sent your documents to the police department.'], // Hallucinated quote
      uncertainties: [],
    });

    const res = validateAndGroundForensicExtraction(raw, mockEvidence);
    expect(res.isValid).toBe(true);
    expect(res.schema?.quotedStatements.length).toBe(0);
    expect(res.rejectedClaims.some((r) => r.field === 'quotedStatements')).toBe(true);
  });

  // I. Explicit Threat
  test('I. Explicit threat extracted from evidence is preserved', () => {
    const raw = JSON.stringify({
      incidentType: 'threat',
      incidentSummary: 'Explicit threat identified',
      extractedFacts: [
        {
          fact: 'Offender threatened photo release',
          type: 'threat',
          sourceEvidenceId: 'ev-photo-threat-1',
          sourceSpan: 'I will publish your private photos',
          certainty: 'explicit',
        },
      ],
      actors: [],
      temporalEvents: [],
      threats: ['I will publish your private photos if you do not pay me'],
      harassmentIndicators: [],
      blackmailIndicators: [],
      coercionIndicators: [],
      paymentDemands: [],
      communicationChannels: [],
      phoneNumbers: [],
      urlsAndDomains: [],
      quotedStatements: ['I will publish your private photos if you do not pay me'],
      uncertainties: [],
    });

    const res = validateAndGroundForensicExtraction(raw, mockEvidence);
    expect(res.isValid).toBe(true);
    expect(res.schema?.threats.length).toBe(1);
    expect(res.schema?.extractedFacts[0].certainty).toBe('explicit');
  });

  // J. Blackmail / Payment Demand
  test('J. Blackmail and payment demands with amount/targets are captured', () => {
    const raw = JSON.stringify({
      incidentType: 'blackmail',
      incidentSummary: 'Blackmail demand',
      extractedFacts: [],
      actors: [],
      temporalEvents: [],
      threats: [],
      harassmentIndicators: [],
      blackmailIndicators: ['Demanding $5,000 to prevent private photo leak'],
      coercionIndicators: ['Financial coercion'],
      paymentDemands: ['$5,000 to UPI ID victim@okbank'],
      communicationChannels: [],
      phoneNumbers: [],
      urlsAndDomains: [],
      quotedStatements: [],
      uncertainties: [],
    });

    const res = validateAndGroundForensicExtraction(raw, mockEvidence);
    expect(res.isValid).toBe(true);
    expect(res.schema?.blackmailIndicators.length).toBe(1);
    expect(res.schema?.paymentDemands.length).toBe(1);
  });

  // K. Evidence with no threat
  test('K. Benign evidence without threats produces empty threat arrays', () => {
    const benignEvidence: EvidenceItemContext[] = [
      {
        id: 'ev-receipt-1',
        media_type: 'IMAGE',
        file_path: 'files/receipt.jpg',
        ocr_text: 'Coffee Shop Receipt. 1x Cappuccino $4.50. Thank you for visiting!',
        import_ts: 1725710000000,
        sha256_import: 'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
      },
    ];

    const raw = JSON.stringify({
      incidentType: 'benign',
      incidentSummary: 'A standard retail purchase receipt.',
      extractedFacts: [
        {
          fact: 'Purchase of cappuccino for $4.50',
          type: 'financial',
          sourceEvidenceId: 'ev-receipt-1',
          sourceSpan: 'Cappuccino $4.50',
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

    const res = validateAndGroundForensicExtraction(raw, benignEvidence);
    expect(res.isValid).toBe(true);
    expect(res.schema?.incidentType).toBe('benign');
    expect(res.schema?.threats.length).toBe(0);
    expect(res.schema?.paymentDemands.length).toBe(0);
  });

  // L. Empty evidence context handling
  test('L. Empty evidence items handled gracefully', () => {
    const raw = JSON.stringify({
      incidentType: 'other',
      incidentSummary: 'No evidence available.',
      extractedFacts: [],
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
      uncertainties: ['No evidence supplied for analysis.'],
    });

    const res = validateAndGroundForensicExtraction(raw, []);
    expect(res.isValid).toBe(true);
    expect(res.schema?.uncertainties).toContain('No evidence supplied for analysis.');
  });

  // M. Mixed explicit fact + inference
  test('M. Mixed explicit facts and inferences preserve their distinct classifications', () => {
    const raw = JSON.stringify({
      incidentType: 'blackmail',
      incidentSummary: 'Summary',
      extractedFacts: [
        {
          fact: 'Message requested $5,000',
          type: 'financial',
          sourceEvidenceId: 'ev-photo-threat-1',
          sourceSpan: 'pay me $5,000',
          certainty: 'explicit',
        },
        {
          fact: 'Perpetrator likely has access to victim social media',
          type: 'inference',
          sourceEvidenceId: 'ev-photo-threat-1',
          certainty: 'inferred',
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
    const facts = res.schema?.extractedFacts;
    expect(facts?.[0].certainty).toBe('explicit');
    expect(facts?.[1].certainty).toBe('inferred');
  });

  // N. Multiple evidence items
  test('N. Multiple evidence items are correctly indexed and cited', () => {
    const raw = JSON.stringify({
      incidentType: 'blackmail',
      incidentSummary: 'Combined photo and voicemail harassment',
      extractedFacts: [
        {
          fact: 'Voicemail from Alex demanding payment',
          type: 'statement',
          sourceEvidenceId: 'ev-audio-call-2',
          sourceSpan: 'Alex speaking',
          certainty: 'explicit',
        },
        {
          fact: 'Photo message demanding $5,000',
          type: 'financial',
          sourceEvidenceId: 'ev-photo-threat-1',
          sourceSpan: 'pay me $5,000',
          certainty: 'explicit',
        },
      ],
      actors: [
        {
          name: 'Alex',
          role: 'perpetrator',
          identifiers: [],
          certainty: 'explicit',
        },
      ],
      temporalEvents: [],
      threats: [],
      harassmentIndicators: [],
      blackmailIndicators: [],
      coercionIndicators: [],
      paymentDemands: [],
      communicationChannels: ['Voicemail', 'Photo Message'],
      phoneNumbers: [],
      urlsAndDomains: [],
      quotedStatements: [
        'I will publish your private photos if you do not pay me',
        'Send the money through this UPI ID or I will send the screenshots',
      ],
      uncertainties: [],
    });

    const res = validateAndGroundForensicExtraction(raw, mockEvidence);
    expect(res.isValid).toBe(true);
    expect(res.schema?.extractedFacts.length).toBe(2);
    expect(res.schema?.quotedStatements.length).toBe(2);
  });

  // O. Timestamp preservation
  test('O. Valid timestamps are preserved without fabrication', () => {
    const raw = JSON.stringify({
      incidentType: 'threat',
      incidentSummary: 'Summary',
      extractedFacts: [],
      actors: [],
      temporalEvents: [
        {
          timestamp: '2026-09-08T08:00:00Z',
          description: 'Ultimatum deadline set',
          eventType: 'threat',
          severity: 5,
          sourceEvidenceId: 'ev-audio-call-2',
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
    expect(res.schema?.temporalEvents[0].timestamp).toBe('2026-09-08T08:00:00Z');
    expect(res.schema?.temporalEvents[0].severity).toBe(5);
  });

  // P & Q. End-to-End SQLite Persistence and Hash Chain ANALYZE Event
  test('P & Q. Full Forensic Analysis Pipeline persists to SQLite and creates hash chain ANALYZE event', async () => {
    // 1. Create a test case and evidence in SQLite
    const testCase = await databaseEngine.createCase({
      case_number: `TR-TEST-${Date.now()}`,
      title: 'Step 8 Hardware Grounding Test',
      description: 'Validation of SQLite persistence and hash ledger',
      investigator_name: 'Investigator Agent',
      status: 'ACTIVE',
    });

    const testEvidence = await databaseEngine.insertEvidence({
      case_id: testCase.id,
      file_path: 'sandbox/threat_letter.jpg',
      media_type: 'IMAGE',
      import_ts: Date.now(),
      sha256_import: '1111111111111111111111111111111111111111111111111111111111111111',
      ocr_text: 'I will publish your private photos if you do not pay me $5,000 to UPI ID victim@okbank. Call 9876543210.',
    });

    // Mock local inference model output for pipeline integration test
    const mockModelOutput = JSON.stringify({
      incidentType: 'blackmail',
      incidentSummary: 'Blackmail threat demanding $5,000.',
      extractedFacts: [
        {
          fact: 'Demanded $5,000 to prevent photo disclosure',
          type: 'financial',
          sourceEvidenceId: testEvidence.id,
          sourceSpan: 'pay me $5,000',
          certainty: 'explicit',
        },
      ],
      actors: [
        {
          name: 'Blackmailer',
          role: 'perpetrator',
          identifiers: ['9876543210', 'victim@okbank'],
          certainty: 'explicit',
        },
      ],
      temporalEvents: [
        {
          timestamp: '2026-09-08T09:00:00Z',
          description: 'Payment demand sent with photo leak threat',
          eventType: 'demand',
          severity: 5,
          sourceEvidenceId: testEvidence.id,
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

    // Spy on onDeviceInferenceService.inferForensicExtraction to return valid grounded model result
    const spy = jest.spyOn(onDeviceInferenceService, 'inferForensicExtraction').mockResolvedValueOnce({
      schema: validateAndGroundForensicExtraction(mockModelOutput, [testEvidence]).schema,
      rawOutput: mockModelOutput,
      durationMs: 4200,
      warnings: [],
      rejectedClaims: [],
      chunksCount: 1,
    });

    const analysisResult = await forensicAnalysisService.analyzeCaseEvidence(testCase.id);

    expect(analysisResult.caseId).toBe(testCase.id);
    expect(analysisResult.persistedEventIds.length).toBe(1);
    expect(analysisResult.persistedActorIds.length).toBe(1);
    expect(analysisResult.hashChainNodeId).toBeDefined();
    expect(analysisResult.payloadHash).toBeDefined();

    // Verify Event in SQLite
    const savedEvents = await databaseEngine.getEventsForCase(testCase.id);
    expect(savedEvents.length).toBe(1);
    expect(savedEvents[0].severity).toBe(5);
    expect(savedEvents[0].evidence_ids).toContain(testEvidence.id);

    // Verify Actor in SQLite
    const savedActors = await databaseEngine.getActorsForCase(testCase.id);
    expect(savedActors.length).toBe(1);
    expect(savedActors[0].name).toBe('Blackmailer');
    expect(savedActors[0].role).toBe('offender');

    // Verify Narrative in SQLite
    const savedNarrative = await databaseEngine.getLatestNarrativeForCase(testCase.id);
    expect(savedNarrative).not.toBeNull();
    expect(savedNarrative?.content).toContain('### Incident Summary (BLACKMAIL)');
    expect(savedNarrative?.disclaimer).toContain('Gemma 2B INT4 on-device');

    // Verify Hash Chain Node in SQLite
    const chainHistory = await chainService.getChain(testEvidence.id);
    expect(chainHistory.some((node) => node.operation === 'ANALYZE')).toBe(true);

    spy.mockRestore();
  });
});

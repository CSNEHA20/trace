import {
  parseModelJson,
  validateForensicExtraction,
  chunkEvidenceText,
} from '../../ai/inference/inferenceJson';
import {
  GEMMA_PROMPTS,
  buildForensicAnalysisPrompt,
  ForensicExtractionSchema,
} from '../../ai/prompts/gemmaPrompts';
import { OnDeviceInferenceService } from '../../ai/inference/inferenceService';
import { mediaPipeClient } from '../../ai/inference/mediapipeClient';
import { forensicAnalysisService } from '../src/services/forensicAnalysisService';
import { databaseEngine } from '../../database/services/databaseEngine';
import { databaseService } from '../src/services/databaseService';

jest.mock('../../ai/inference/mediapipeClient', () => ({
  mediaPipeClient: {
    getCapability: jest.fn(),
    loadModel: jest.fn(),
    runLLMInference: jest.fn(),
    isModelLoaded: jest.fn(),
    unloadModel: jest.fn(),
  },
  AiAvailability: {
    AVAILABLE: 'AVAILABLE',
    MODEL_MISSING: 'MODEL_MISSING',
    UNSUPPORTED_DEVICE: 'UNSUPPORTED_DEVICE',
    BRIDGE_MISSING: 'BRIDGE_MISSING',
    ERROR: 'ERROR',
  },
  ModelLifecycle: {
    UNLOADED: 'UNLOADED',
    LOADING: 'LOADING',
    READY: 'READY',
    RUNNING: 'RUNNING',
    ERROR: 'ERROR',
  },
}));

describe('TRACE Step 7: Local Gemma Forensic Extraction Unit Tests', () => {
  const mockClient = mediaPipeClient as jest.Mocked<typeof mediaPipeClient>;
  let inferenceService: OnDeviceInferenceService;

  beforeEach(() => {
    jest.clearAllMocks();
    inferenceService = new OnDeviceInferenceService();
    mockClient.getCapability.mockResolvedValue({
      availability: 'AVAILABLE',
      lifecycle: 'READY',
      accelerator: 'MediaPipe Android On-Device Runtime',
      modelPath: '/data/data/com.trace/files/trace-models/gemma-2b-it-int4.task',
      modelSizeBytes: 1445000000,
      detail: 'Local Gemma 2B INT4 model found.',
    });
  });

  // ── Scenario 1: Harassment-style text ──────────────────────────────────────
  it('correctly structures harassment-style evidence extraction', async () => {
    const rawGemmaOutput = JSON.stringify({
      incidentType: 'harassment',
      incidentSummary: 'Repeated unwanted contacting with explicit intent to intimidate the victim.',
      extractedFacts: [
        {
          fact: 'Sent over 40 unsolicited messages in 2 hours.',
          type: 'communication',
          sourceEvidenceId: 'E1',
          sourceSpan: 'Stop ignoring me, you have to answer',
          certainty: 'explicit',
        },
      ],
      actors: [
        {
          name: 'Unknown Caller',
          role: 'perpetrator',
          identifiers: ['+1-555-0199'],
          certainty: 'explicit',
        },
        {
          name: 'Jane Doe',
          role: 'victim',
          identifiers: ['janedoe@example.com'],
          certainty: 'explicit',
        },
      ],
      temporalEvents: [
        {
          timestamp: '2026-09-07T10:15:00Z',
          description: 'Spam barrage of intimidating messages started.',
          eventType: 'escalation',
          severity: 4,
          sourceEvidenceId: 'E1',
          certainty: 'explicit',
        },
      ],
      threats: ['You will regret blocking me.'],
      harassmentIndicators: ['High frequency messaging', 'Ignored explicit cease requests'],
      blackmailIndicators: [],
      coercionIndicators: ['Persistent pressure to reply'],
      paymentDemands: [],
      communicationChannels: ['SMS'],
      phoneNumbers: ['+1-555-0199'],
      urlsAndDomains: [],
      quotedStatements: ['Stop ignoring me, you have to answer'],
      uncertainties: ['Caller identity not registered to known contact.'],
    });

    const parsed = parseModelJson<any>(rawGemmaOutput);
    expect(parsed.parseError).toBeUndefined();
    const validation = validateForensicExtraction(parsed.value, 'E1');
    expect(validation.isValid).toBe(true);
    expect(validation.normalized?.incidentType).toBe('harassment');
    expect(validation.normalized?.harassmentIndicators).toContain('High frequency messaging');
    expect(validation.normalized?.extractedFacts[0].certainty).toBe('explicit');
    expect(validation.normalized?.extractedFacts[0].sourceEvidenceId).toBe('E1');
  });

  // ── Scenario 2: Blackmail-style text ───────────────────────────────────────
  it('correctly structures blackmail and extortion evidence extraction', async () => {
    const rawGemmaOutput = JSON.stringify({
      incidentType: 'blackmail',
      incidentSummary: 'Perpetrator demanded financial payment under threat of releasing private personal photos.',
      extractedFacts: [
        {
          fact: 'Perpetrator demanded $5,000 in cryptocurrency by Friday.',
          type: 'financial',
          sourceEvidenceId: 'E2',
          sourceSpan: 'Pay $5,000 in BTC or everyone sees your pictures',
          certainty: 'explicit',
        },
      ],
      actors: [
        {
          name: 'Blackmailer',
          role: 'perpetrator',
          identifiers: ['@anon_shadow'],
          certainty: 'explicit',
        },
      ],
      temporalEvents: [
        {
          timestamp: '2026-09-07T12:00:00Z',
          description: 'Extortion demand delivered via Telegram.',
          eventType: 'demand',
          severity: 5,
          sourceEvidenceId: 'E2',
          certainty: 'explicit',
        },
      ],
      threats: ['Release of private photos if funds are not transferred'],
      harassmentIndicators: [],
      blackmailIndicators: ['Explicit photo disclosure threat', 'Monetary extortion'],
      coercionIndicators: ['Imposed strict deadline: Friday 5 PM'],
      paymentDemands: ['$5,000 in BTC'],
      communicationChannels: ['Telegram'],
      phoneNumbers: [],
      urlsAndDomains: [],
      quotedStatements: ['Pay $5,000 in BTC or everyone sees your pictures'],
      uncertainties: [],
    });

    const parsed = parseModelJson<any>(rawGemmaOutput);
    const validation = validateForensicExtraction(parsed.value, 'E2');
    expect(validation.isValid).toBe(true);
    expect(validation.normalized?.incidentType).toBe('blackmail');
    expect(validation.normalized?.blackmailIndicators).toHaveLength(2);
    expect(validation.normalized?.paymentDemands).toContain('$5,000 in BTC');
  });

  // ── Scenario 3: Threat-style text ──────────────────────────────────────────
  it('correctly captures violent or physical threats with severity ranking', async () => {
    const rawGemmaOutput = JSON.stringify({
      incidentType: 'threat',
      incidentSummary: 'Physical harm threats issued against the victim outside their workplace.',
      extractedFacts: [
        {
          fact: 'Perpetrator stated they were waiting outside building 4.',
          type: 'statement',
          sourceEvidenceId: 'E3',
          sourceSpan: 'I know where you work, see you in parking lot',
          certainty: 'explicit',
        },
      ],
      actors: [
        {
          name: 'Target Person',
          role: 'victim',
          identifiers: [],
          certainty: 'explicit',
        },
      ],
      temporalEvents: [
        {
          timestamp: '2026-09-07T18:30:00Z',
          description: 'Direct physical safety threat made.',
          eventType: 'threat',
          severity: 5,
          sourceEvidenceId: 'E3',
          certainty: 'explicit',
        },
      ],
      threats: ['I know where you work, see you in parking lot'],
      harassmentIndicators: [],
      blackmailIndicators: [],
      coercionIndicators: ['Intimidation by physical presence'],
      paymentDemands: [],
      communicationChannels: ['WhatsApp'],
      phoneNumbers: [],
      urlsAndDomains: [],
      quotedStatements: ['see you in parking lot'],
      uncertainties: [],
    });

    const parsed = parseModelJson<any>(rawGemmaOutput);
    const validation = validateForensicExtraction(parsed.value, 'E3');
    expect(validation.isValid).toBe(true);
    expect(validation.normalized?.incidentType).toBe('threat');
    expect(validation.normalized?.temporalEvents[0].severity).toBe(5);
  });

  // ── Scenario 4: Benign conversation ────────────────────────────────────────
  it('handles benign non-incident communication without fabricating false alarms', async () => {
    const rawGemmaOutput = JSON.stringify({
      incidentType: 'benign',
      incidentSummary: 'Routine logistical discussion regarding dinner plans with no threats or coercion.',
      extractedFacts: [
        {
          fact: 'Meeting at 7 PM for dinner.',
          type: 'statement',
          sourceEvidenceId: 'E4',
          certainty: 'explicit',
        },
      ],
      actors: [
        {
          name: 'Alice',
          role: 'unknown',
          identifiers: [],
          certainty: 'explicit',
        },
        {
          name: 'Bob',
          role: 'unknown',
          identifiers: [],
          certainty: 'explicit',
        },
      ],
      temporalEvents: [
        {
          timestamp: '2026-09-07T19:00:00Z',
          description: 'Scheduled dinner meeting.',
          eventType: 'other',
          severity: 1,
          sourceEvidenceId: 'E4',
          certainty: 'explicit',
        },
      ],
      threats: [],
      harassmentIndicators: [],
      blackmailIndicators: [],
      coercionIndicators: [],
      paymentDemands: [],
      communicationChannels: ['SMS'],
      phoneNumbers: [],
      urlsAndDomains: [],
      quotedStatements: ['See you at 7 PM'],
      uncertainties: [],
    });

    const parsed = parseModelJson<any>(rawGemmaOutput);
    const validation = validateForensicExtraction(parsed.value, 'E4');
    expect(validation.isValid).toBe(true);
    expect(validation.normalized?.incidentType).toBe('benign');
    expect(validation.normalized?.threats).toHaveLength(0);
    expect(validation.normalized?.blackmailIndicators).toHaveLength(0);
  });

  // ── Scenario 5: Text containing explicit dates/times ───────────────────────
  it('preserves verbatim date/time timestamps accurately', async () => {
    const rawGemmaOutput = JSON.stringify({
      incidentType: 'threat',
      incidentSummary: 'Threat sent with specific deadline.',
      extractedFacts: [
        {
          fact: 'Event scheduled for September 15, 2026 at 14:30 EST.',
          type: 'statement',
          sourceEvidenceId: 'E5',
          certainty: 'explicit',
        },
      ],
      actors: [],
      temporalEvents: [
        {
          timestamp: '2026-09-15T14:30:00-05:00',
          description: 'Specific timestamp referenced in message body.',
          eventType: 'threat',
          severity: 3,
          sourceEvidenceId: 'E5',
          certainty: 'explicit',
        },
      ],
      threats: ['Deadline expires Sept 15 at 14:30'],
      harassmentIndicators: [],
      blackmailIndicators: [],
      coercionIndicators: [],
      paymentDemands: [],
      communicationChannels: ['Email'],
      phoneNumbers: [],
      urlsAndDomains: [],
      quotedStatements: ['Sept 15 at 14:30'],
      uncertainties: [],
    });

    const parsed = parseModelJson<any>(rawGemmaOutput);
    const validation = validateForensicExtraction(parsed.value, 'E5');
    expect(validation.isValid).toBe(true);
    expect(validation.normalized?.temporalEvents[0].timestamp).toBe('2026-09-15T14:30:00-05:00');
  });

  // ── Scenario 6: Multiple actors and explicit vs inferred certainty ─────────
  it('distinguishes explicit vs inferred roles across multiple actors', async () => {
    const rawGemmaOutput = JSON.stringify({
      incidentType: 'harassment',
      incidentSummary: 'Multiple individuals participating in targeted group harassment.',
      extractedFacts: [
        {
          fact: 'Actor A instructed Actor B to forward sensitive records.',
          type: 'action',
          sourceEvidenceId: 'E6',
          certainty: 'inferred',
        },
      ],
      actors: [
        {
          name: 'Alex Vance',
          role: 'perpetrator',
          identifiers: ['@vance_a'],
          certainty: 'explicit',
        },
        {
          name: 'Corroborating Witness',
          role: 'witness',
          identifiers: [],
          certainty: 'inferred',
        },
      ],
      temporalEvents: [],
      threats: [],
      harassmentIndicators: ['Group coordination'],
      blackmailIndicators: [],
      coercionIndicators: [],
      paymentDemands: [],
      communicationChannels: ['Group Chat'],
      phoneNumbers: [],
      urlsAndDomains: [],
      quotedStatements: [],
      uncertainties: ['Witness degree of direct involvement is inferred from group chat participant list.'],
    });

    const parsed = parseModelJson<any>(rawGemmaOutput);
    const validation = validateForensicExtraction(parsed.value, 'E6');
    expect(validation.isValid).toBe(true);
    const actors = validation.normalized!.actors;
    expect(actors[0].certainty).toBe('explicit');
    expect(actors[1].certainty).toBe('inferred');
    expect(validation.normalized!.uncertainties).toHaveLength(1);
  });

  // ── Scenario 7: Text with no identifiable incident ────────────────────────
  it('handles text with no identifiable incident safely', async () => {
    const rawGemmaOutput = JSON.stringify({
      incidentType: 'other',
      incidentSummary: 'Extracted text contains fragmented system log lines without forensic actionable indicators.',
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
      uncertainties: ['Input consists of system debugging logs.'],
    });

    const parsed = parseModelJson<any>(rawGemmaOutput);
    const validation = validateForensicExtraction(parsed.value, 'E7');
    expect(validation.isValid).toBe(true);
    expect(validation.normalized?.incidentType).toBe('other');
    expect(validation.normalized?.extractedFacts).toHaveLength(0);
  });

  // ── Scenario 8: Incomplete / ambiguous evidence ────────────────────────────
  it('records ambiguities in uncertainties rather than inventing missing facts', async () => {
    const rawGemmaOutput = JSON.stringify({
      incidentType: 'other',
      incidentSummary: 'Fragmented audio transcription contains incomplete sentence.',
      extractedFacts: [
        {
          fact: 'Speaker mentioned a delivery on Friday.',
          type: 'statement',
          sourceEvidenceId: 'E8',
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
      communicationChannels: ['Audio Recording'],
      phoneNumbers: [],
      urlsAndDomains: [],
      quotedStatements: ['deliver on Friday... then we...'],
      uncertainties: ['Audio cuts off abruptly; context of delivery is unknown.'],
    });

    const parsed = parseModelJson<any>(rawGemmaOutput);
    const validation = validateForensicExtraction(parsed.value, 'E8');
    expect(validation.isValid).toBe(true);
    expect(validation.normalized?.uncertainties[0]).toContain('Audio cuts off abruptly');
  });

  // ── Scenario 9: Malformed model output handling ────────────────────────────
  it('handles malformed JSON honestly and fails without returning fake mock data', async () => {
    const malformedRaw = 'I analyzed the text and found harassment. [NOT VALID JSON { "incident": ...';
    const parsed = parseModelJson<any>(malformedRaw);
    expect(parsed.value).toBeUndefined();
    expect(parsed.parseError).toBeDefined();

    mockClient.runLLMInference.mockResolvedValue(malformedRaw);

    const result = await inferenceService.inferForensicExtraction('Sample context evidence');
    expect(result.schema).toBeUndefined();
    expect(result.parseError).toBeDefined();
    expect(result.rawOutput).toBe(malformedRaw);
  });

  // ── Scenario 10: Empty evidence rejection ──────────────────────────────────
  it('rejects empty evidence before calling native model inference', async () => {
    await expect(inferenceService.inferForensicExtraction('')).rejects.toThrow('Evidence context is empty');
    expect(mockClient.runLLMInference).not.toHaveBeenCalled();
  });

  // ── Scenario 11: End-to-End Forensic Analysis Pipeline with DB & Ledger ────
  it('executes full pipeline: evidence context -> Gemma -> SQLite -> Hash Chain ledger', async () => {
    // 1. Create a test case and evidence in SQLite
    const createdCase = await databaseEngine.createCase({
      case_number: `TR-2026-${Math.floor(1000 + Math.random() * 9000)}`,
      title: 'Step 7 Pipeline Test Case',
      investigator_name: 'Lead Examiner',
      status: 'ACTIVE',
    });

    const evidence1 = await databaseEngine.insertEvidence({
      case_id: createdCase.id,
      file_path: 'file:///data/sandbox/screenshot_harass.png',
      media_type: 'IMAGE',
      import_ts: Date.now(),
      sha256_import: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      ocr_text: 'I know where you live. Stop reporting me or else. 2026-09-07 14:00',
    });

    // 2. Mock model returning structured valid JSON
    const modelOutput = JSON.stringify({
      incidentType: 'threat',
      incidentSummary: 'Direct intimidation and threat to discourage reporting.',
      extractedFacts: [
        {
          fact: 'Perpetrator warned victim to stop reporting.',
          type: 'statement',
          sourceEvidenceId: evidence1.id,
          sourceSpan: 'Stop reporting me or else',
          certainty: 'explicit',
        },
      ],
      actors: [
        {
          name: 'Threatening Actor',
          role: 'perpetrator',
          identifiers: [],
          certainty: 'explicit',
        },
      ],
      temporalEvents: [
        {
          timestamp: '2026-09-07T14:00:00Z',
          description: 'Threat message sent to victim.',
          eventType: 'threat',
          severity: 4,
          sourceEvidenceId: evidence1.id,
          certainty: 'explicit',
        },
      ],
      threats: ['Stop reporting me or else'],
      harassmentIndicators: ['Retaliatory threat'],
      blackmailIndicators: [],
      coercionIndicators: ['Coercive demand to stop reporting'],
      paymentDemands: [],
      communicationChannels: ['Screenshot'],
      phoneNumbers: [],
      urlsAndDomains: [],
      quotedStatements: ['Stop reporting me or else'],
      uncertainties: [],
    });

    mockClient.runLLMInference.mockResolvedValue(modelOutput);

    // 3. Run analysis through ForensicAnalysisService
    const pipelineResult = await forensicAnalysisService.analyzeCaseEvidence(createdCase.id);

    expect(pipelineResult.caseId).toBe(createdCase.id);
    expect(pipelineResult.schema.incidentType).toBe('threat');
    expect(pipelineResult.persistedEventIds.length).toBe(1);
    expect(pipelineResult.persistedActorIds.length).toBe(1);
    expect(pipelineResult.hashChainNodeId).toBeDefined();

    // 4. Verify SQLite persistence of narrative
    const latestNarrative = await databaseService.getLatestNarrativeForCase(createdCase.id);
    expect(latestNarrative).not.toBeNull();
    expect(latestNarrative?.content).toContain('Stop reporting me or else');

    // 5. Verify Hash Chain ledger entry
    const chainRecords = await databaseService.getHashChainForEvidence(evidence1.id);
    expect(chainRecords.length).toBeGreaterThan(0);
    const analyzeRecord = chainRecords.find(r => r.operation === 'ANALYZE');
    expect(analyzeRecord).toBeDefined();
    expect(analyzeRecord?.payload_hash.length).toBe(64);
  });
});

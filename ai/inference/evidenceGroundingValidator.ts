import {
  ForensicExtractionSchema,
  ForensicFact,
  ForensicActor,
  ForensicEvent,
} from '../prompts/gemmaPrompts';

export interface EvidenceItemContext {
  id: string;
  media_type?: string;
  file_path?: string;
  ocr_text?: string;
  transcription?: string;
  import_ts?: number;
  exif_ts?: number;
  sha256_import?: string;
}

export interface RejectedClaim {
  field: string;
  value: any;
  reason: string;
  sourceEvidenceId?: string;
}

export interface GroundingValidationResult {
  isValid: boolean;
  status: 'VALID' | 'INVALID_MODEL_OUTPUT' | 'EVIDENCE_VALIDATION_FAILED';
  schema?: ForensicExtractionSchema;
  rawOutput: string;
  parseError?: string;
  warnings: string[];
  rejectedClaims: RejectedClaim[];
}

/**
 * Normalizes text for fuzzy whitespace/punctuation matching during evidence verification.
 */
function normalizeForMatching(text: string): string {
  return text
    .toLowerCase()
    .replace(/["'“”‘’]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extracts digit-only string for telephone number comparison.
 */
function extractDigits(text: string): string {
  return text.replace(/\D/g, '');
}

/**
 * Deterministic JSON parser that isolates the outermost JSON object and performs safe cleanup.
 */
export function extractAndParseJson<T = any>(raw: string): { value?: T; error?: string } {
  if (!raw || !raw.trim()) {
    return { error: 'Model output is empty.' };
  }

  const trimmed = raw.trim();

  // Strip markdown code fences if present
  const cleaned = trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  // 1. Direct JSON parse
  try {
    return { value: JSON.parse(cleaned) as T };
  } catch {
    // Proceed to substring detection
  }

  // 2. Locate outermost '{' and '}'
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');

  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const candidate = cleaned.slice(firstBrace, lastBrace + 1);
    try {
      return { value: JSON.parse(candidate) as T };
    } catch {
      // 3. Normalize trailing commas
      const sanitized = candidate.replace(/,\s*([\]}])/g, '$1');
      try {
        return { value: JSON.parse(sanitized) as T };
      } catch (err: any) {
        return { error: `Failed to parse JSON object: ${err.message}` };
      }
    }
  }

  return { error: 'No JSON object structure found in model output.' };
}

/**
 * Deterministic Evidence-Grounding Validator.
 * 
 * Strict Forensic Provenance Rules:
 * 1. sourceEvidenceId MUST exist in the current case's evidence list (case isolation).
 * 2. If sourceEvidenceId is missing or invalid: REJECT the claim from verified persistence. NEVER remap or guess.
 * 3. Quoted statements MUST exist verbatim in evidence OCR or transcription.
 * 4. Phone numbers and URLs/Domains MUST appear in evidence text.
 * 5. Explicit actors MUST have their identifier in evidence text; otherwise reclassified to inferred.
 * 6. Certainty="inferred" is NOT used to rescue invalid provenance. Invalid provenance is strictly rejected.
 * 7. Safe, deterministic aliases ("fact", "facts", "events", "timeline", "entities", "quotes") are normalized prior to validation.
 */
export function validateAndGroundForensicExtraction(
  rawModelOutput: string,
  evidenceItems: EvidenceItemContext[]
): GroundingValidationResult {
  const warnings: string[] = [];
  const rejectedClaims: RejectedClaim[] = [];

  const parsed = extractAndParseJson<any>(rawModelOutput);
  if (parsed.error || !parsed.value || typeof parsed.value !== 'object' || Array.isArray(parsed.value)) {
    return {
      isValid: false,
      status: 'INVALID_MODEL_OUTPUT',
      rawOutput: rawModelOutput,
      parseError: parsed.error || 'Model output is not a valid JSON object.',
      warnings: ['Raw model output did not contain parseable JSON conforming to schema.'],
      rejectedClaims: [],
    };
  }

  const data = parsed.value;
  // Strict case-scoped valid evidence IDs
  const validEvidenceIds = new Set(evidenceItems.map((e) => e.id));

  // Build searchable text maps
  const evidenceTextMap = new Map<string, string>();
  let fullCorpusNormalized = '';

  for (const item of evidenceItems) {
    const combined = [
      item.ocr_text || '',
      item.transcription || '',
      item.file_path || '',
    ].join(' ');
    const norm = normalizeForMatching(combined);
    evidenceTextMap.set(item.id, norm);
    fullCorpusNormalized += ' ' + norm;
  }
  fullCorpusNormalized = fullCorpusNormalized.trim();

  // 1. Incident Type
  const allowedIncidentTypes = [
    'harassment',
    'blackmail',
    'threat',
    'extortion',
    'impersonation',
    'financial_fraud',
    'benign',
    'other',
  ];
  const rawIncidentType = String(data.incidentType || 'other').toLowerCase();
  const incidentType = (allowedIncidentTypes.includes(rawIncidentType) ? rawIncidentType : 'other') as ForensicExtractionSchema['incidentType'];

  // 2. Incident Summary
  const incidentSummary = typeof data.incidentSummary === 'string' && data.incidentSummary.trim()
    ? data.incidentSummary.trim()
    : 'Incident analysis generated from local evidence.';

  // Helper to normalize array or single object from deterministic aliases
  const toObjectArray = (val: any): any[] => {
    if (Array.isArray(val)) return val;
    if (val && typeof val === 'object') return [val];
    return [];
  };

  // 3. Extracted Facts (Deterministic Aliases: extractedFacts, facts, fact)
  const rawFactsSource = data.extractedFacts !== undefined
    ? data.extractedFacts
    : (data.facts !== undefined ? data.facts : data.fact);

  const validatedFacts: ForensicFact[] = [];
  const rawFactsList = toObjectArray(rawFactsSource);

  for (const f of rawFactsList) {
    if (!f || typeof f !== 'object') continue;
    const factText = String(f.fact ?? f.summary ?? f.text ?? '').trim();
    if (!factText) continue;

    const sourceIdRaw = f.sourceEvidenceId !== undefined && f.sourceEvidenceId !== null ? String(f.sourceEvidenceId).trim() : '';

    // STRICT PROVENANCE RULE:
    // If sourceEvidenceId is missing or does not match an evidence record in the current case, REJECT IT.
    // NEVER remap to default/primary evidence.
    if (!sourceIdRaw || !validEvidenceIds.has(sourceIdRaw)) {
      warnings.push(`Fact "${factText.slice(0, 30)}…" references invalid or missing evidence ID "${sourceIdRaw || 'MISSING'}". Claim rejected.`);
      rejectedClaims.push({
        field: 'extractedFacts',
        value: factText,
        reason: 'INVALID_SOURCE_EVIDENCE_ID',
        sourceEvidenceId: sourceIdRaw || undefined,
      });
      continue; // Strictly skip persistence
    }

    let certainty: 'explicit' | 'inferred' = f.certainty === 'inferred' ? 'inferred' : 'explicit';
    const sourceSpan = f.sourceSpan ? String(f.sourceSpan).trim() : undefined;

    // If marked explicit with a sourceSpan, verify sourceSpan actually appears in the referenced evidence text
    if (certainty === 'explicit' && sourceSpan) {
      const itemText = evidenceTextMap.get(sourceIdRaw) || '';
      if (!itemText.includes(normalizeForMatching(sourceSpan))) {
        certainty = 'inferred';
        warnings.push(`Fact quote "${sourceSpan.slice(0, 30)}…" not found verbatim in evidence ${sourceIdRaw}; reclassified as inferred.`);
      }
    }

    validatedFacts.push({
      fact: factText,
      type: String(f.type || 'statement'),
      sourceEvidenceId: sourceIdRaw,
      sourceSpan,
      certainty,
    });
  }

  // 4. Actors (Deterministic Aliases: actors, entities, people)
  const rawActorsSource = data.actors !== undefined
    ? data.actors
    : (data.entities !== undefined ? data.entities : data.people);

  const validatedActors: ForensicActor[] = [];
  const rawActorsList = toObjectArray(rawActorsSource);

  for (const a of rawActorsList) {
    if (!a) continue;
    const name = typeof a === 'string' ? a.trim() : String(a.name ?? '').trim();
    if (!name) continue;

    const role = ['perpetrator', 'victim', 'witness', 'unknown'].includes(a.role) ? a.role : 'unknown';
    const identifiers = Array.isArray(a.identifiers) ? a.identifiers.map(String).map((s: string) => s.trim()).filter(Boolean) : [];
    let certainty: 'explicit' | 'inferred' = a.certainty === 'inferred' ? 'inferred' : 'explicit';

    // Verify if actor name occurs in evidence text
    const nameNormalized = normalizeForMatching(name);
    const nameInEvidence = nameNormalized.length > 1 && fullCorpusNormalized.includes(nameNormalized);

    if (certainty === 'explicit' && !nameInEvidence && !['unknown', 'victim', 'perpetrator', 'suspect', 'sender', 'caller'].includes(nameNormalized)) {
      certainty = 'inferred';
      warnings.push(`Actor name "${name}" does not appear explicitly in evidence text; reclassified to inferred.`);
      rejectedClaims.push({
        field: 'actors.name',
        value: name,
        reason: `Actor name "${name}" was not found in supplied evidence OCR or transcripts.`,
      });
    }

    validatedActors.push({
      name,
      role,
      identifiers,
      certainty,
    });
  }

  // 5. Temporal Events (Deterministic Aliases: temporalEvents, events, timeline)
  const rawEventsSource = data.temporalEvents !== undefined
    ? data.temporalEvents
    : (data.events !== undefined ? data.events : data.timeline);

  const validatedEvents: ForensicEvent[] = [];
  const rawEventsList = toObjectArray(rawEventsSource);

  for (const e of rawEventsList) {
    if (!e || typeof e !== 'object') continue;
    const desc = String(e.description ?? e.summary ?? '').trim();
    if (!desc) continue;

    const sourceIdRaw = e.sourceEvidenceId !== undefined && e.sourceEvidenceId !== null ? String(e.sourceEvidenceId).trim() : '';

    // STRICT PROVENANCE RULE:
    // If sourceEvidenceId is missing or does not match an evidence record in the current case, REJECT IT.
    // NEVER remap to default/primary evidence.
    if (!sourceIdRaw || !validEvidenceIds.has(sourceIdRaw)) {
      warnings.push(`Temporal event "${desc.slice(0, 30)}…" references invalid or missing evidence ID "${sourceIdRaw || 'MISSING'}". Claim rejected.`);
      rejectedClaims.push({
        field: 'temporalEvents',
        value: desc,
        reason: 'INVALID_SOURCE_EVIDENCE_ID',
        sourceEvidenceId: sourceIdRaw || undefined,
      });
      continue; // Strictly skip persistence
    }

    const eventType = [
      'initial_contact',
      'threat',
      'demand',
      'escalation',
      'evidence_sharing',
      'impersonation',
      'other',
    ].includes(e.eventType) ? e.eventType : 'other';

    const severity = typeof e.severity === 'number' && e.severity >= 1 && e.severity <= 5
      ? Math.round(e.severity)
      : 3;

    validatedEvents.push({
      timestamp: e.timestamp ? String(e.timestamp) : null,
      description: desc,
      eventType,
      severity,
      sourceEvidenceId: sourceIdRaw,
      certainty: e.certainty === 'inferred' ? 'inferred' : 'explicit',
    });
  }

  // Helper string array extractor supporting aliases
  const toStringArray = (val: any): string[] => {
    if (!Array.isArray(val)) {
      if (typeof val === 'string' && val.trim().length > 0) return [val.trim()];
      return [];
    }
    return val.map(String).map(s => s.trim()).filter(s => s.length > 0);
  };

  // 6. Quoted Statements (Deterministic Aliases: quotedStatements, quotes)
  const validatedQuotes: string[] = [];
  const rawQuotes = toStringArray(data.quotedStatements !== undefined ? data.quotedStatements : data.quotes);
  for (const quote of rawQuotes) {
    const normQuote = normalizeForMatching(quote);
    if (normQuote.length >= 4 && fullCorpusNormalized.includes(normQuote)) {
      validatedQuotes.push(quote);
    } else {
      warnings.push(`Quoted statement "${quote.slice(0, 30)}…" was not found verbatim in evidence text.`);
      rejectedClaims.push({
        field: 'quotedStatements',
        value: quote,
        reason: 'Quote does not occur verbatim in the supplied evidence text or transcripts.',
      });
    }
  }

  // 7. Phone Numbers (Deterministic Aliases: phoneNumbers, phones)
  const validatedPhones: string[] = [];
  const rawPhones = toStringArray(data.phoneNumbers !== undefined ? data.phoneNumbers : data.phones);
  const corpusDigits = extractDigits(fullCorpusNormalized);

  for (const phone of rawPhones) {
    const digits = extractDigits(phone);
    if (digits.length >= 4 && corpusDigits.includes(digits)) {
      validatedPhones.push(phone);
    } else {
      warnings.push(`Phone number "${phone}" was not found in supplied evidence text.`);
      rejectedClaims.push({
        field: 'phoneNumbers',
        value: phone,
        reason: `Phone number digits "${digits}" do not appear in evidence text.`,
      });
    }
  }

  // 8. URLs and Domains (Deterministic Aliases: urlsAndDomains, urlsOrDomains, urls)
  const validatedUrls: string[] = [];
  const rawUrls = toStringArray(data.urlsAndDomains !== undefined ? data.urlsAndDomains : (data.urlsOrDomains !== undefined ? data.urlsOrDomains : data.urls));
  for (const url of rawUrls) {
    const normUrl = normalizeForMatching(url).replace(/^https?:\/\//, '');
    if (normUrl.length >= 3 && fullCorpusNormalized.includes(normUrl)) {
      validatedUrls.push(url);
    } else {
      warnings.push(`URL/Domain "${url}" was not found in supplied evidence text.`);
      rejectedClaims.push({
        field: 'urlsOrDomains',
        value: url,
        reason: `URL or domain "${url}" does not appear in evidence text.`,
      });
    }
  }

  // 9. Other Indicators
  const threats = toStringArray(data.threats);
  const harassmentIndicators = toStringArray(data.harassmentIndicators);
  const blackmailIndicators = toStringArray(data.blackmailIndicators);
  const coercionIndicators = toStringArray(data.coercionIndicators);
  const paymentDemands = toStringArray(data.paymentDemands);
  const communicationChannels = toStringArray(data.communicationChannels);
  const uncertainties = toStringArray(data.uncertainties);

  // Add rejected items to uncertainties for forensic auditability
  if (rejectedClaims.length > 0) {
    for (const rej of rejectedClaims) {
      const srcInfo = rej.sourceEvidenceId ? ` [Evidence ID: ${rej.sourceEvidenceId}]` : '';
      uncertainties.push(`[VALIDATION REJECTION] ${rej.field}${srcInfo}: "${rej.value}" - ${rej.reason}`);
    }
  }

  const normalizedSchema: ForensicExtractionSchema = {
    incidentType,
    incidentSummary,
    extractedFacts: validatedFacts,
    actors: validatedActors,
    temporalEvents: validatedEvents,
    threats,
    harassmentIndicators,
    blackmailIndicators,
    coercionIndicators,
    paymentDemands,
    communicationChannels,
    phoneNumbers: validatedPhones,
    urlsAndDomains: validatedUrls,
    quotedStatements: validatedQuotes,
    uncertainties,
  };

  return {
    isValid: true,
    status: 'VALID',
    schema: normalizedSchema,
    rawOutput: rawModelOutput,
    warnings,
    rejectedClaims,
  };
}

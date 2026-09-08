/**
 * Forensic Gemma Prompts for TRACE On-Device MediaPipe LLM Integration.
 * 
 * Strict forensic rules enforced:
 * 1. Analyze ONLY supplied evidence.
 * 2. Never invent or assume facts, dates, actors, or events not present in evidence.
 * 3. Distinguish EXPLICIT facts from INFERRED facts.
 * 4. Retain evidence citations (evidenceId / reference tag) on every extracted fact.
 * 5. Return clean, machine-parseable JSON without markdown wrapper fences.
 */

const STRICT_JSON_SYSTEM_INSTRUCTION = `You are TRACE, a local on-device forensic evidence analysis engine.
Strict Rules:
- Analyze ONLY the supplied evidence text and metadata.
- Do NOT invent, assume, or manufacture facts, dates, timestamps, individuals, phone numbers, URLs, or events.
- If information is missing or not mentioned, return empty arrays or null.
- Every fact and event MUST cite the sourceEvidenceId from the evidence item.
- Distinguish certainty: "explicit" (verbatim or directly stated in evidence) vs "inferred" (logical deduction from context).
- Return ONLY valid raw JSON conforming strictly to the requested schema. No conversational filler, no markdown formatting fences.`;

export interface ForensicFact {
  fact: string;
  type: string;
  sourceEvidenceId: string;
  sourceSpan?: string;
  certainty: 'explicit' | 'inferred';
}

export interface ForensicActor {
  name: string;
  role: 'perpetrator' | 'victim' | 'witness' | 'unknown';
  identifiers: string[];
  certainty: 'explicit' | 'inferred';
}

export interface ForensicEvent {
  timestamp: string | null;
  description: string;
  eventType: 'initial_contact' | 'threat' | 'demand' | 'escalation' | 'evidence_sharing' | 'impersonation' | 'other';
  severity: number; // 1 to 5
  sourceEvidenceId: string;
  certainty: 'explicit' | 'inferred';
}

export interface ForensicExtractionSchema {
  incidentType: 'harassment' | 'blackmail' | 'threat' | 'extortion' | 'impersonation' | 'financial_fraud' | 'benign' | 'other';
  incidentSummary: string;
  extractedFacts: ForensicFact[];
  actors: ForensicActor[];
  temporalEvents: ForensicEvent[];
  threats: string[];
  harassmentIndicators: string[];
  blackmailIndicators: string[];
  coercionIndicators: string[];
  paymentDemands: string[];
  communicationChannels: string[];
  phoneNumbers: string[];
  urlsAndDomains: string[];
  quotedStatements: string[];
  uncertainties: string[];
}

export const GEMMA_PROMPTS = {
  FORENSIC_EXTRACTION: `${STRICT_JSON_SYSTEM_INSTRUCTION}

Analyze the supplied evidence items and extract structured forensic indicators.

JSON Schema format:
{
  "incidentType": "harassment|blackmail|threat|extortion|impersonation|financial_fraud|benign|other",
  "incidentSummary": "Concise factual summary of the incident based exclusively on evidence",
  "extractedFacts": [
    {
      "fact": "Specific verified fact",
      "type": "statement|action|communication|financial|other",
      "sourceEvidenceId": "evidence_id",
      "sourceSpan": "exact excerpt or phrase",
      "certainty": "explicit|inferred"
    }
  ],
  "actors": [
    {
      "name": "Identified name or alias",
      "role": "perpetrator|victim|witness|unknown",
      "identifiers": ["phone/handle/email if present in text"],
      "certainty": "explicit|inferred"
    }
  ],
  "temporalEvents": [
    {
      "timestamp": "exact timestamp or date string, or null",
      "description": "description of event",
      "eventType": "initial_contact|threat|demand|escalation|evidence_sharing|impersonation|other",
      "severity": 1,
      "sourceEvidenceId": "evidence_id",
      "certainty": "explicit|inferred"
    }
  ],
  "threats": ["Explicit threat statements citing evidence ID"],
  "harassmentIndicators": ["Harassment actions observed"],
  "blackmailIndicators": ["Blackmail or extortion elements"],
  "coercionIndicators": ["Coercion tactics used"],
  "paymentDemands": ["Financial or ransom demands"],
  "communicationChannels": ["WhatsApp|SMS|Email|Call|etc"],
  "phoneNumbers": ["Phone numbers appearing in evidence"],
  "urlsAndDomains": ["Links/URLs appearing in evidence"],
  "quotedStatements": ["Crucial verbatim quotes from evidence"],
  "uncertainties": ["Ambiguities, contradictions, or missing critical details"]
}`,

  EVIDENCE_SUMMARY: `${STRICT_JSON_SYSTEM_INSTRUCTION} Summarize only explicit facts in the supplied evidence text. Return {"summary":"string","facts":["string"],"uncertainties":["string"]}.`,

  TIMELINE_CLUSTERING: `${STRICT_JSON_SYSTEM_INSTRUCTION} Reconstruct incident events only from the supplied extracted evidence text. Allowed event_type values: initial_contact, threat, demand, escalation, evidence_sharing, impersonation, other. Severity is an integer 1-5. Return {"events":[{"event_type":"initial_contact|threat|demand|escalation|evidence_sharing|impersonation|other","severity":1,"summary":"string","timestamp_hint":"string|null","evidence_refs":["string"]}]}`,

  ENTITY_EXTRACTION: `${STRICT_JSON_SYSTEM_INSTRUCTION} Extract only names, usernames, phone numbers, locations, and dates that occur in the supplied evidence. Return {"actors":["string"],"locations":["string"],"dates":["string"]}.`,

  INCIDENT_NARRATIVE: `You are TRACE, an on-device forensic evidence assistant. Write a neutral, factual incident narrative in plain English using only the supplied reconstructed events and evidence references. Do not invent facts, dates, people, or evidence. Do not use emotional language, exaggeration, or unsupported claims.

Structure the narrative in exactly five paragraphs:

Paragraph 1: Who contacted whom, when the incident began, and the initial nature of the contact. Use only events of type initial_contact and their evidence_refs.

Paragraph 2: Escalation, threats, and demands. Use only events of type threat, demand, escalation and their evidence_refs.

Paragraph 3: Sharing, impersonation, or third-party involvement. Use only events of type evidence_sharing, impersonation and their evidence_refs.

Paragraph 4: Victim actions where applicable (responses, reports, protective measures). Use only events of type other and their evidence_refs if they describe victim actions.

Paragraph 5: Current status and outstanding risks based on the most recent event timestamps and event types.

Rules:
- Each paragraph must cite evidence_refs from the events it describes (e.g., "E1, E3").
- If no events exist for a paragraph's topic, write: "No events of this type were reconstructed from the evidence."
- Use neutral, clinical language. No adjectives that imply judgment.
- Do not include events that were rejected or have unsupported evidence_refs.
- Output only the narrative text. No JSON, no markdown, no extra commentary.`,
} as const;

/**
 * Builds normalized prompt with formatted evidence context.
 */
export function buildForensicAnalysisPrompt(evidenceContext: string): string {
  return `${GEMMA_PROMPTS.FORENSIC_EXTRACTION}

EVIDENCE CONTEXT:
${evidenceContext}

STRUCTURED FORENSIC JSON RESPONSE:`;
}

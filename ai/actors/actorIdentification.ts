import {
  ActorRecord,
  ActorIdentifier,
  ActorIdentifierType,
  ActorRole,
  ActorMatchResult,
  CrossEvidenceActorMatch,
  EvidenceRecord,
} from '../../frontend/src/types';

const SIMILARITY_THRESHOLD = 0.8;
const MIN_MATCH_CONFIDENCE = 0.6;

export interface ExtractedActorData {
  name: string;
  role?: ActorRole;
  identifiers: ActorIdentifier[];
  confidence: number;
  uncertainty_notes?: string[];
  source_evidence_id: string;
}

function normalizePhoneNumber(phone: string): string {
  return phone.replace(/[\s\-\(\)\+]/g, '').replace(/^0+/, '');
}

function normalizeUsername(username: string): string {
  return username.toLowerCase().trim().replace(/^@/, '');
}

function identifiersEqual(
  a: ActorIdentifier,
  b: ActorIdentifier,
  type: ActorIdentifierType
): boolean {
  if (a.type !== type || b.type !== type) return false;

  switch (type) {
    case 'phone_number':
      return normalizePhoneNumber(a.value) === normalizePhoneNumber(b.value);
    case 'username':
      return normalizeUsername(a.value) === normalizeUsername(b.value);
    case 'email':
      return a.value.toLowerCase().trim() === b.value.toLowerCase().trim();
    case 'display_name':
      return a.value.toLowerCase().trim() === b.value.toLowerCase().trim();
    case 'face_detection':
      return a.value === b.value;
    case 'ai_context':
      return a.value.toLowerCase().trim() === b.value.toLowerCase().trim();
    default:
      return a.value === b.value;
  }
}

function calculateIdentifierMatchScore(
  newId: ActorIdentifier,
  existingId: ActorIdentifier
): number {
  if (newId.type !== existingId.type) return 0;

  switch (newId.type) {
    case 'phone_number':
      return normalizePhoneNumber(newId.value) === normalizePhoneNumber(existingId.value) ? 1.0 : 0;
    case 'username':
      return normalizeUsername(newId.value) === normalizeUsername(existingId.value) ? 1.0 : 0;
    case 'email':
      return newId.value.toLowerCase().trim() === existingId.value.toLowerCase().trim() ? 1.0 : 0;
    case 'display_name':
      return newId.value.toLowerCase().trim() === existingId.value.toLowerCase().trim() ? 1.0 : 0;
    case 'face_detection':
      return newId.value === existingId.value ? 0.9 : 0;
    case 'ai_context':
      return newId.value.toLowerCase().trim() === existingId.value.toLowerCase().trim() ? 0.7 : 0;
    default:
      return 0;
  }
}

export function extractActorsFromEvidence(evidence: EvidenceRecord): ExtractedActorData[] {
  const actors: ExtractedActorData[] = [];
  const text = [
    evidence.ocr_text || '',
    evidence.transcription || '',
  ].join('\n').trim();

  if (!text) return actors;

  const phoneRegex = /(?:\+?\d{1,3}[\s\-]?)?\(?\d{3}\)?[\s\-]?\d{3}[\s\-]?\d{4}/g;
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
  const usernameRegex = /@([A-Za-z0-9_.-]+)/g;
  const nameRegex = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b/g;

  const phones = text.match(phoneRegex) || [];
  const emails = text.match(emailRegex) || [];
  const usernames = text.match(usernameRegex) || [];
  const names = text.match(nameRegex) || [];

  const uniquePhones = [...new Set(phones)];
  const uniqueEmails = [...new Set(emails)];
  const uniqueUsernames = [...new Set(usernames.map(u => u.slice(1)))];
  const uniqueNames = [...new Set(names)];

  for (const name of uniqueNames) {
    const identifiers: ActorIdentifier[] = [];
    const now = Date.now();

    for (const phone of uniquePhones) {
      identifiers.push({
        type: 'phone_number',
        value: phone,
        evidence_ids: [evidence.id],
        confidence: 0.9,
        first_seen: now,
        last_seen: now,
      });
    }

    for (const email of uniqueEmails) {
      identifiers.push({
        type: 'email',
        value: email,
        evidence_ids: [evidence.id],
        confidence: 0.95,
        first_seen: now,
        last_seen: now,
      });
    }

    for (const username of uniqueUsernames) {
      identifiers.push({
        type: 'username',
        value: username,
        evidence_ids: [evidence.id],
        confidence: 0.9,
        first_seen: now,
        last_seen: now,
      });
    }

    const faceCount = (evidence as any).facesCount || 0;
    if (faceCount > 0) {
      identifiers.push({
        type: 'face_detection',
        value: `face_${evidence.id}_${faceCount}`,
        evidence_ids: [evidence.id],
        confidence: 0.5,
        first_seen: now,
        last_seen: now,
      });
    }

    const aiConfidence = identifiers.length > 0 ? 0.7 : 0.3;
    identifiers.push({
      type: 'ai_context',
      value: name,
      evidence_ids: [evidence.id],
      confidence: aiConfidence,
      first_seen: now,
      last_seen: now,
    });

    actors.push({
      name,
      role: 'unknown',
      identifiers,
      confidence: identifiers.length > 0 ? 0.7 : 0.3,
      uncertainty_notes: identifiers.length === 0 ? ['No identifiers found in evidence'] : [],
      source_evidence_id: evidence.id,
    });
  }

  if (actors.length === 0 && (uniquePhones.length > 0 || uniqueEmails.length > 0 || uniqueUsernames.length > 0)) {
    const identifiers: ActorIdentifier[] = [];
    const now = Date.now();

    for (const phone of uniquePhones) {
      identifiers.push({
        type: 'phone_number',
        value: phone,
        evidence_ids: [evidence.id],
        confidence: 0.9,
        first_seen: now,
        last_seen: now,
      });
    }

    for (const email of uniqueEmails) {
      identifiers.push({
        type: 'email',
        value: email,
        evidence_ids: [evidence.id],
        confidence: 0.95,
        first_seen: now,
        last_seen: now,
      });
    }

    for (const username of uniqueUsernames) {
      identifiers.push({
        type: 'username',
        value: username,
        evidence_ids: [evidence.id],
        confidence: 0.9,
        first_seen: now,
        last_seen: now,
      });
    }

    actors.push({
      name: 'Unknown Actor',
      role: 'unknown',
      identifiers,
      confidence: 0.6,
      uncertainty_notes: ['Actor name not found in evidence; identified only by contact information'],
      source_evidence_id: evidence.id,
    });
  }

  return actors;
}

export function matchActorsAcrossEvidence(
  newActors: ExtractedActorData[],
  existingActors: ActorRecord[]
): { matches: ActorMatchResult[]; newActors: ExtractedActorData[] } {
  const matches: ActorMatchResult[] = [];
  const remainingNewActors: ExtractedActorData[] = [];

  for (const newActor of newActors) {
    let bestMatch: ActorMatchResult | null = null;
    let bestScore = 0;

    for (const existingActor of existingActors) {
      const matchedIdentifiers: ActorIdentifier[] = [];
      let totalScore = 0;
      let matchCount = 0;

      for (const newId of newActor.identifiers) {
        for (const existingId of existingActor.identifiers) {
          const score = calculateIdentifierMatchScore(newId, existingId);
          if (score > 0) {
            matchedIdentifiers.push(existingId);
            totalScore += score * newId.confidence * existingId.confidence;
            matchCount++;
          }
        }
      }

      if (matchCount > 0) {
        const avgScore = totalScore / matchCount;
        if (avgScore > bestScore && avgScore >= MIN_MATCH_CONFIDENCE) {
          bestScore = avgScore;
          bestMatch = {
            actor_id: existingActor.id,
            matched_identifiers: matchedIdentifiers,
            confidence: avgScore,
            match_reason: `Matched ${matchCount} identifier(s) with ${(avgScore * 100).toFixed(0)}% confidence`,
          };
        }
      }
    }

    if (bestMatch) {
      matches.push(bestMatch);
    } else {
      remainingNewActors.push(newActor);
    }
  }

  return { matches, newActors: remainingNewActors };
}

export function mergeActorIdentifiers(
  existingActor: ActorRecord,
  newActorData: ExtractedActorData
): ActorRecord {
  const mergedIdentifiers = [...existingActor.identifiers];
  const now = Date.now();
  const allUncertaintyNotes = [...(existingActor.uncertainty_notes || [])];

  for (const newId of newActorData.identifiers) {
    const existingIndex = mergedIdentifiers.findIndex(
      (eid) => identifiersEqual(eid, newId, newId.type)
    );

    if (existingIndex >= 0) {
      const existingId = mergedIdentifiers[existingIndex];
      mergedIdentifiers[existingIndex] = {
        ...existingId,
        evidence_ids: [...new Set([...existingId.evidence_ids, ...newId.evidence_ids])],
        confidence: Math.max(existingId.confidence, newId.confidence),
        last_seen: Math.max(existingId.last_seen, newId.last_seen),
      };
    } else {
      mergedIdentifiers.push({
        ...newId,
        evidence_ids: [...newId.evidence_ids],
      });
    }
  }

  const newConfidence = calculateActorConfidence(mergedIdentifiers);

  return {
    ...existingActor,
    identifiers: mergedIdentifiers,
    confidence: newConfidence,
    uncertainty_notes: allUncertaintyNotes.length > 0 ? allUncertaintyNotes : undefined,
    updated_at: now,
  };
}

function calculateActorConfidence(identifiers: ActorIdentifier[]): number {
  if (identifiers.length === 0) return 0;

  const weights: Record<ActorIdentifierType, number> = {
    phone_number: 1.0,
    email: 1.0,
    username: 0.9,
    display_name: 0.7,
    ai_context: 0.5,
    face_detection: 0.4,
  };

  let weightedSum = 0;
  let totalWeight = 0;

  for (const id of identifiers) {
    const weight = weights[id.type] || 0.5;
    weightedSum += id.confidence * weight;
    totalWeight += weight;
  }

  return totalWeight > 0 ? weightedSum / totalWeight : 0;
}

export function findCrossEvidenceMatches(
  actors: ActorRecord[]
): CrossEvidenceActorMatch[] {
  const matches: CrossEvidenceActorMatch[] = [];

  for (let i = 0; i < actors.length; i++) {
    for (let j = i + 1; j < actors.length; j++) {
      const actorA = actors[i];
      const actorB = actors[j];

      const matchedIdentifiers: ActorIdentifier[] = [];
      const evidenceOverlap: string[] = [];

      for (const idA of actorA.identifiers) {
        for (const idB of actorB.identifiers) {
          if (identifiersEqual(idA, idB, idA.type)) {
            matchedIdentifiers.push(idA);
            for (const eid of idA.evidence_ids) {
              if (idB.evidence_ids.includes(eid) && !evidenceOverlap.includes(eid)) {
                evidenceOverlap.push(eid);
              }
            }
          }
        }
      }

      if (matchedIdentifiers.length > 0) {
        const matchConfidence = matchedIdentifiers.reduce((sum, id) => sum + id.confidence, 0) / matchedIdentifiers.length;
        
        if (matchConfidence >= SIMILARITY_THRESHOLD) {
          matches.push({
            primary_actor_id: actorA.id,
            matched_actor_id: actorB.id,
            match_confidence: matchConfidence,
            matched_identifiers: matchedIdentifiers,
            evidence_overlap: evidenceOverlap,
          });
        }
      }
    }
  }

  return matches;
}

export function inferActorRole(
  actor: ActorRecord,
  evidence: EvidenceRecord[]
): ActorRole {
  const relevantEvidence = evidence.filter((e) =>
    actor.identifiers.some((id) => id.evidence_ids.includes(e.id))
  );

  const text = relevantEvidence
    .flatMap((e) => [e.ocr_text || '', e.transcription || ''])
    .join('\n')
    .toLowerCase();

  const offenderKeywords = ['threat', 'blackmail', 'extort', 'demand', 'pay', 'money', 'bitcoin', 'crypto', 'wallet', 'send', 'transfer', 'hack', 'breach', 'leak', 'expose', 'ruin', 'destroy'];
  const victimKeywords = ['help', 'police', 'report', 'scared', 'afraid', 'victim', 'innocent', 'please', 'stop', 'don\'t', 'leave me alone'];
  const bystanderKeywords = ['witness', 'saw', 'heard', 'know', 'information', 'contact', 'reach out'];

  let offenderScore = 0;
  let victimScore = 0;
  let bystanderScore = 0;

  for (const kw of offenderKeywords) {
    if (text.includes(kw)) offenderScore++;
  }
  for (const kw of victimKeywords) {
    if (text.includes(kw)) victimScore++;
  }
  for (const kw of bystanderKeywords) {
    if (text.includes(kw)) bystanderScore++;
  }

  if (offenderScore > victimScore && offenderScore > bystanderScore) return 'offender';
  if (victimScore > offenderScore && victimScore > bystanderScore) return 'victim';
  if (bystanderScore > offenderScore && bystanderScore > victimScore) return 'bystander';

  return 'unknown';
}
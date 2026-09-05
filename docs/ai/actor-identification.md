# TRACE Actor Identification

## Overview

The Actor Identification system extracts, matches, and links actors (people/entities) across evidence in a forensic case. It operates on-device using deterministic extraction and optional AI-assisted analysis, maintaining strict evidence-backed identity claims with confidence scoring and uncertainty documentation.

## Core Principles

1. **Evidence-Backed Claims Only**: Every actor identity claim must be traceable to specific evidence
2. **No Facial Recognition**: Face detection identifies faces but does NOT establish real-world identity
3. **Confidence Scoring**: All associations carry explicit confidence scores (0.0-1.0)
4. **Uncertainty Documentation**: Gaps and conflicts are explicitly recorded
5. **Cross-Evidence Correlation**: Actors are matched across evidence using identifiers, not assumptions

## Data Model

### ActorRecord

```typescript
interface ActorRecord {
  id: string;                    // UUID
  case_id: string;               // Case foreign key
  name: string;                  // Display name from evidence
  role: ActorRole;               // victim | offender | bystander | other | unknown
  identifiers: ActorIdentifier[]; // All identifiers linked to this actor
  confidence: number;            // 0.0-1.0 overall confidence
  uncertainty_notes?: string[];  // Documented uncertainties
  created_at: number;            // Unix timestamp
  updated_at: number;            // Unix timestamp
}
```

### ActorIdentifier

```typescript
interface ActorIdentifier {
  type: ActorIdentifierType;     // username | phone_number | email | display_name | face_detection | ai_context
  value: string;                 // The identifier value
  evidence_ids: string[];        // Evidence IDs where this identifier appears
  confidence: number;            // 0.0-1.0 confidence in this identifier
  first_seen: number;            // First evidence timestamp
  last_seen: number;             // Most recent evidence timestamp
}
```

### ActorRole

- `victim` - Person being targeted/threatened
- `offender` - Person making threats/demands
- `bystander` - Witness or third party with relevant info
- `other` - Known role not fitting above categories
- `unknown` - Role cannot be determined from evidence

### ActorIdentifierType

- `username` - Chat/social media handles (@username)
- `phone_number` - Phone numbers in any format
- `email` - Email addresses
- `display_name` - Display names shown in chat interfaces
- `face_detection` - Reference to face detection output (e.g., "face_E1_3")
- `ai_context` - Names/references from AI analysis of evidence text

## Identification Pipeline

### 1. Deterministic Extraction (`extractActorsFromEvidence`)

Runs on every evidence item without AI:

- **Phone Numbers**: Regex extraction with normalization
- **Emails**: Standard email regex
- **Usernames**: @handle pattern matching
- **Names**: Capitalized multi-word patterns
- **Face Detection**: References face count from AI analysis
- **AI Context**: Names from OCR/transcription text

Each extracted actor gets:
- Unique identifiers with evidence references
- Base confidence scores per identifier type
- Uncertainty notes for gaps

### 2. AI-Assisted Extraction (Optional)

Uses Gemma 2B on-device with prompt:

```
ENTITY_EXTRACTION_PROMPT: Extract actors with identifiers, roles, confidence, uncertainties
```

AI extraction supplements deterministic results, never replaces them.

### 3. Cross-Evidence Matching (`matchActorsAcrossEvidence`)

Matches new extractions against existing actors:

| Identifier Type | Match Logic | Weight |
|-----------------|-------------|--------|
| phone_number | Exact after normalization | 1.0 |
| username | Exact after @ removal + lowercase | 1.0 |
| email | Exact case-insensitive | 1.0 |
| display_name | Exact case-insensitive | 0.7 |
| face_detection | Exact face reference match | 0.9 |
| ai_context | Exact case-insensitive | 0.5 |

**Match Threshold**: 0.6 minimum confidence
**Similarity Threshold**: 0.8 for cross-evidence actor merging

### 4. Actor Merging

When matches exceed threshold:

1. Combine identifiers (union of evidence_ids)
2. Take maximum confidence per identifier
3. Recalculate overall actor confidence (weighted average)
4. Preserve uncertainty notes from both actors
5. Record merge in actor history

### 5. Role Inference (`inferActorRole`)

Keyword-based heuristic on actor's evidence:

- **Offender**: threat, blackmail, extort, demand, pay, bitcoin, crypto, wallet, send, transfer, hack, breach, leak, expose, ruin, destroy
- **Victim**: help, police, report, scared, afraid, victim, innocent, please, stop, "leave me alone"
- **Bystander**: witness, saw, heard, know, information, contact, "reach out"

Highest scoring category wins; ties default to `unknown`.

### 6. Event Linking

Actors linked to events via evidence overlap:

- Event has evidence_ids from clustering
- Actor has evidence_ids from identifiers
- Overlap → actor linked to event
- Confidence = average identifier confidence on overlapping evidence
- Minimum 0.5 confidence to create link

## Database Schema

```sql
CREATE TABLE actors (
  id TEXT PRIMARY KEY NOT NULL,
  case_id TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  contact_info TEXT,
  identifiers TEXT NOT NULL DEFAULT '[]',      -- JSON array of ActorIdentifier
  confidence REAL NOT NULL DEFAULT 0,
  uncertainty_notes TEXT,                     -- JSON array of strings
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
);

CREATE INDEX idx_actors_case_id ON actors(case_id);
```

## Repository Interface

```typescript
interface IActorRepository {
  insertActor(a: ActorRecord): Promise<ActorRecord>;
  updateActor(id: string, updates: Partial<ActorRecord>): Promise<ActorRecord | null>;
  getActorById(id: string): Promise<ActorRecord | null>;
  getActorsForCase(caseId: string): Promise<ActorRecord[]>;
  deleteActor(id: string): Promise<boolean>;
  addIdentifier(actorId: string, identifier: ActorIdentifier): Promise<ActorRecord | null>;
  findActorByIdentifier(caseId: string, type: ActorIdentifierType, value: string): Promise<ActorRecord | null>;
  findActorsByIdentifiers(caseId: string, identifiers: ActorIdentifier[]): Promise<ActorMatchResult[]>;
  mergeActors(primaryActorId: string, secondaryActorId: string): Promise<ActorRecord | null>;
  getActorsForEvidence(evidenceId: string): Promise<ActorRecord[]>;
  linkActorToEvidence(actorId: string, evidenceId: string): Promise<void>;
  unlinkActorFromEvidence(actorId: string, evidenceId: string): Promise<void>;
}
```

## Pipeline Usage

```typescript
import { actorPipeline } from 'ai/actors';

const result = await actorPipeline.runCase(caseId, {
  onProgress: (p) => console.log(p.stage, p.message),
});

// Result contains:
// - actors: ActorRecord[] (all actors for case)
// - actorIdentification: ActorIdentificationResult (detailed results)
// - events: EventRecord[] (events with actor_ids populated)
// - chainNodeIds: string[] (integrity chain nodes)
```

## Testing Scenarios

### Same Username Across Evidence
- Evidence 1: `@john_doe` in chat
- Evidence 2: `@john_doe` in screenshot
- **Expected**: Single actor, high confidence (1.0), linked to both evidence

### Same Phone Number
- Evidence 1: `+1-555-123-4567` in SMS
- Evidence 2: `(555) 123-4567` in contact list
- **Expected**: Single actor after normalization, high confidence

### Multiple Actors
- Evidence 1: `@alice` and `@bob` in conversation
- Evidence 2: `@alice` and `@charlie` in another chat
- **Expected**: 3 actors (alice, bob, charlie), alice linked across both

### No Actors
- Evidence with only landscapes, no text, no faces
- **Expected**: Empty actor list, no errors

### Repeated Face Detection
- Evidence 1: 2 faces detected → `face_E1_2`
- Evidence 2: 2 faces detected → `face_E2_2`
- **Expected**: Two separate face_detection identifiers (different evidence), NOT merged

### Conflicting Evidence
- Evidence 1: `@john` says "I'm the victim"
- Evidence 2: `@john` makes threats
- **Expected**: Single actor `@john`, role `unknown` (conflicting keywords), uncertainty_notes documenting conflict

## Confidence Scoring

### Identifier Weights

| Type | Weight |
|------|--------|
| phone_number | 1.0 |
| email | 1.0 |
| username | 0.9 |
| display_name | 0.7 |
| ai_context | 0.5 |
| face_detection | 0.4 |

### Overall Actor Confidence

Weighted average of identifier confidences × weights.

### Event Link Confidence

Average of identifier confidences on overlapping evidence.

## Uncertainty Handling

Uncertainty notes are added when:
- No identifiers found for extracted name
- Conflicting roles inferred from different evidence
- Face detection references without name correlation
- AI extraction confidence below 0.5
- Identifier match below threshold but above noise floor

## Integrity Chain

Actor identification operations create hash chain nodes:

- Operation: `ACTOR_IDENTIFICATION`
- Payload: Actor data, matches, merges, role inferences
- Linked to all evidence IDs involved

## Limitations

1. **No Facial Recognition**: Face detection only provides `face_detection` identifiers. These are evidence-scoped references, not identity claims.
2. **No External Lookups**: All identification is self-contained within case evidence.
3. **Heuristic Role Inference**: Keyword-based, not definitive. Always marked with uncertainty when ambiguous.
4. **Deterministic First**: AI supplements but never overrides deterministic extraction.

## Configuration

Environment variables (optional):
- `ACTOR_MATCH_THRESHOLD` (default: 0.6)
- `ACTOR_SIMILARITY_THRESHOLD` (default: 0.8)
- `ACTOR_ROLE_KEYWORDS` (custom keyword lists)

## API Reference

### actorIdentificationService.identifyActors(caseId, evidence, options)

Main entry point for actor identification.

### actorPipeline.runCase(caseId, options)

Full pipeline: identify actors → persist → cluster events → link actors to events.

### databaseEngine actor methods

Direct database access for CRUD and matching operations.
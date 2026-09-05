# TRACE — Database Schema Reference

> **Version:** 1.0.0 | Migration v1: `001_initial_schema_v1`
> **Engine:** In-memory `DatabaseEngine` (maps 1:1 to expo-sqlite production layer)
> **Constraint:** Evidence raw binary is NEVER stored in the database. Only file path references to the private on-device sandbox are persisted.

---

## Tables

### `migrations_history`
Tracks applied schema migrations for safe upgrades.

| Column       | Type    | Constraints               | Description                             |
|-------------|---------|---------------------------|-----------------------------------------|
| `id`        | TEXT    | PRIMARY KEY               | Unique migration UUID                   |
| `version`   | INTEGER | UNIQUE, NOT NULL          | Sequential migration version            |
| `name`      | TEXT    | NOT NULL                  | Human-readable migration name           |
| `applied_at`| INTEGER | NOT NULL                  | UNIX ms timestamp of when applied       |

---

### `cases`
Root entity. Each forensic investigation case.

| Column             | Type    | Constraints               | Description                             |
|-------------------|---------|---------------------------|-----------------------------------------|
| `id`              | TEXT    | PRIMARY KEY               | UUID v4                                 |
| `case_number`     | TEXT    | UNIQUE, NOT NULL          | Human-readable case ref (e.g. TR-2026-1234) |
| `title`           | TEXT    | NOT NULL                  | Case display title                      |
| `description`     | TEXT    |                           | Optional narrative                      |
| `investigator_name` | TEXT  | NOT NULL                  | Primary investigator                    |
| `status`          | TEXT    | NOT NULL                  | `ACTIVE` \| `ARCHIVED` \| `CLOSED` \| `UNDER_REVIEW` |
| `created_at`      | INTEGER | NOT NULL                  | UNIX ms timestamp                       |
| `updated_at`      | INTEGER | NOT NULL                  | UNIX ms timestamp (auto-updated)        |

**Indexes:** `idx_cases_status`, `idx_cases_case_number`

---

### `evidence`
Immutable evidence items. Stores metadata + file path reference only.

| Column              | Type    | Constraints               | Description                             |
|--------------------|---------|---------------------------|-----------------------------------------|
| `id`               | TEXT    | PRIMARY KEY               | UUID v4                                 |
| `case_id`          | TEXT    | FK → cases.id, NOT NULL   | Parent case                             |
| `file_path`        | TEXT    | NOT NULL                  | Private sandbox URI (never raw binary)  |
| `media_type`       | TEXT    | NOT NULL                  | `IMAGE` \| `AUDIO` \| `VIDEO` \| `DOCUMENT` |
| `import_ts`        | INTEGER | NOT NULL                  | UNIX ms timestamp when imported         |
| `exif_ts`          | INTEGER |                           | EXIF/GPS timestamp from media metadata  |
| `user_ts`          | INTEGER |                           | User-confirmed timestamp                |
| `ocr_text`         | TEXT    |                           | OCR output for images/docs              |
| `transcription`    | TEXT    |                           | Audio/video transcription               |
| `sha256_import`    | TEXT    | NOT NULL                  | SHA-256 hash at import (integrity anchor) |
| `sha256_processed` | TEXT    |                           | SHA-256 after AI pipeline completes     |

**Indexes:** `idx_evidence_case_id`, `idx_evidence_sha256_import`
**Cascade Delete:** When parent case is deleted, all evidence is removed.

> ⚠️ **Security Rule:** Raw media bytes are stored in the encrypted private app sandbox. The `file_path` column contains only the URI reference. Evidence integrity is guaranteed by `sha256_import` / `sha256_processed` comparison.

---

### `events`
Timeline events: incident clusters, captures, analyses, exports, tampering alerts.

| Column         | Type    | Constraints               | Description                             |
|---------------|---------|---------------------------|-----------------------------------------|
| `id`          | TEXT    | PRIMARY KEY               | UUID v4                                 |
| `case_id`     | TEXT    | FK → cases.id, NOT NULL   | Parent case                             |
| `event_type`  | TEXT    | NOT NULL                  | Incident types (`initial_contact`, `threat`, `demand`, `escalation`, `evidence_sharing`, `impersonation`, `other`) or system types |
| `severity`    | INTEGER | NOT NULL                  | `1`–`5` (legacy LOW/MEDIUM/HIGH/CRITICAL coerced on write) |
| `timestamp`   | INTEGER | NOT NULL                  | UNIX ms timestamp of the event          |
| `timestamp_hint` | TEXT |                        | Original model or investigator time hint |
| `ai_summary`  | TEXT    |                           | AI-generated natural language summary   |
| `evidence_ids`| TEXT    | NOT NULL                  | JSON array of linked evidence UUIDs     |
| `actor_ids`   | TEXT    | NOT NULL                  | JSON array of linked actor UUIDs        |
| `source`      | TEXT    | NOT NULL                  | `ai` \| `user` \| `system`              |
| `user_annotation` | TEXT |                        | Investigator annotation of an AI event  |
| `user_edited` | INTEGER | NOT NULL                  | `1` if investigator edited the reconstruction |
| `timestamp_conflict` | INTEGER | NOT NULL             | `1` if linked clocks contradict         |
| `timestamp_unresolved` | INTEGER | NOT NULL           | `1` if no parseable timestamp hint      |

**Indexes:** `idx_events_case_id`, `idx_events_timestamp`
**Cascade Delete:** When parent case is deleted, all events are removed.

> ℹ️ `evidence_ids` and `actor_ids` are stored as JSON strings (e.g. `["uuid1","uuid2"]`) and deserialized to arrays on read.

---

### `actors`
People linked to a case: witnesses, suspects, investigators, bystanders.

| Column         | Type    | Constraints               | Description                             |
|---------------|---------|---------------------------|-----------------------------------------|
| `id`          | TEXT    | PRIMARY KEY               | UUID v4                                 |
| `case_id`     | TEXT    | FK → cases.id, NOT NULL   | Parent case                             |
| `name`        | TEXT    | NOT NULL                  | Actor full name                         |
| `role`        | TEXT    | NOT NULL                  | `WITNESS` \| `SUSPECT` \| `INVESTIGATOR` \| `BYSTANDER` etc. |
| `contact_info`| TEXT    |                           | Optional contact information            |
| `created_at`  | INTEGER | NOT NULL                  | UNIX ms timestamp                       |

**Indexes:** `idx_actors_case_id`
**Cascade Delete:** When parent case is deleted, all actors are removed.

---

### `hash_chain`
Tamper-evident hash chain per evidence item. Each operation appends a node linking previous chain hash to the new payload hash.

| Column          | Type    | Constraints               | Description                                          |
|----------------|---------|---------------------------|------------------------------------------------------|
| `id`           | TEXT    | PRIMARY KEY               | UUID v4                                              |
| `evidence_id`  | TEXT    | FK → evidence.id, NOT NULL| Parent evidence item                                 |
| `operation`    | TEXT    | NOT NULL                  | `IMPORT` \| `AI_ANALYSIS` \| `EXPORT` \| `FINAL_SEAL` etc. |
| `payload_hash` | TEXT    | NOT NULL                  | SHA-256 of the data at this operation                |
| `chain_hash`   | TEXT    | NOT NULL                  | SHA-256(prev_chain_hash + payload_hash + operation)  |
| `timestamp`    | INTEGER | NOT NULL                  | UNIX ms timestamp of this chain node                 |

**Indexes:** `idx_hash_chain_evidence_id`, `idx_hash_chain_timestamp`
**Cascade Delete:** When parent evidence is deleted, all hash chain nodes are removed.

---

## Relationships (ERD)

```
cases
 ├── evidence (1:N, FK cases.id → case_id)
 │    └── hash_chain (1:N, FK evidence.id → evidence_id)
 ├── events   (1:N, FK cases.id → case_id)
 │    ├── [JSON] evidence_ids → evidence.id refs
 │    └── [JSON] actor_ids   → actors.id refs
 └── actors   (1:N, FK cases.id → case_id)
```

---

## Migration History

| Version | Name                     | Description                                            |
|---------|--------------------------|--------------------------------------------------------|
| 1       | `001_initial_schema_v1`  | Create all 5 tables, indexes, and foreign key pragmas  |

---

## Integrity Guarantees

| Guarantee                  | Mechanism                                          |
|---------------------------|----------------------------------------------------|
| Evidence hasn't been altered after import | `sha256_import` vs `sha256_processed` comparison |
| Full tamper-detection chain | `hash_chain` table — each node anchors previous hash |
| No orphaned evidence/events | Cascade delete on case delete |
| Unique case numbering | UNIQUE constraint on `cases.case_number` |
| Correct case/evidence linkage | FOREIGN KEY constraints enforced on all child tables |

---

## Usage

```typescript
import { databaseEngine } from 'database/services/databaseEngine';
import { databaseService } from 'src/services/databaseService';

// Initialize on app start
await databaseService.initialize();

// Create a forensic case
const forensicCase = await databaseService.createCase('Case Title', 'Description', 'Investigator');

// Add evidence (stores file_path reference only)
const evidence = await databaseService.addEvidence({
  caseId: forensicCase.id,
  type: 'IMAGE',
  fileUri: 'file:///sandbox/private/scene.jpg',
  sha256Hash: '...',
  // ...
});

// Query hash chain
const chain = await databaseService.getHashChainForEvidence(evidence.id);
```

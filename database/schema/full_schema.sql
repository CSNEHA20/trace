-- TRACE SQLite Master Database Schema
-- Standard: On-Device Encrypted SQLite (expo-sqlite)

PRAGMA foreign_keys = ON;

-- 0. Schema Migrations History Table
CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  applied_at INTEGER NOT NULL
);

-- 1. Cases Table
CREATE TABLE IF NOT EXISTS cases (
  id TEXT PRIMARY KEY NOT NULL,
  case_number TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  investigator_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- 2. Evidence Table
CREATE TABLE IF NOT EXISTS evidence (
  id TEXT PRIMARY KEY NOT NULL,
  case_id TEXT NOT NULL,
  file_path TEXT NOT NULL,
  media_type TEXT NOT NULL,
  import_ts INTEGER NOT NULL,
  exif_ts INTEGER,
  user_ts INTEGER,
  ocr_text TEXT,
  transcription TEXT,
  sha256_import TEXT NOT NULL,
  sha256_processed TEXT,
  FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
);

-- 3. Events Table
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY NOT NULL,
  case_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'MEDIUM',
  timestamp INTEGER NOT NULL,
  ai_summary TEXT,
  evidence_ids TEXT NOT NULL DEFAULT '[]', -- JSON stringified array of evidence IDs
  actor_ids TEXT NOT NULL DEFAULT '[]',    -- JSON stringified array of actor IDs
  FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
);

-- 4. Actors Table
CREATE TABLE IF NOT EXISTS actors (
  id TEXT PRIMARY KEY NOT NULL,
  case_id TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  contact_info TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
);

-- 5. Hash Chain Table
CREATE TABLE IF NOT EXISTS hash_chain (
  id TEXT PRIMARY KEY NOT NULL,
  evidence_id TEXT NOT NULL,
  operation TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  chain_hash TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  FOREIGN KEY (evidence_id) REFERENCES evidence(id) ON DELETE CASCADE
);

-- Database Indexes for Query Optimization & Foreign Key Enforcement
CREATE INDEX IF NOT EXISTS idx_evidence_case_id ON evidence(case_id);
CREATE INDEX IF NOT EXISTS idx_evidence_sha256_import ON evidence(sha256_import);
CREATE INDEX IF NOT EXISTS idx_events_case_id ON events(case_id);
CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp);
CREATE INDEX IF NOT EXISTS idx_actors_case_id ON actors(case_id);
CREATE INDEX IF NOT EXISTS idx_hash_chain_evidence_id ON hash_chain(evidence_id);
CREATE INDEX IF NOT EXISTS idx_hash_chain_timestamp ON hash_chain(timestamp);

-- TRACE Database Initial Migration Schema (001_init)

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

CREATE TABLE IF NOT EXISTS evidence_items (
  id TEXT PRIMARY KEY NOT NULL,
  case_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL,
  file_uri TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  mime_type TEXT NOT NULL,
  sha256_hash TEXT NOT NULL,
  signature TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  exif_data TEXT,
  ai_analysis TEXT,
  is_tampered INTEGER DEFAULT 0,
  tamper_reason TEXT,
  FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS timeline_events (
  id TEXT PRIMARY KEY NOT NULL,
  case_id TEXT NOT NULL,
  evidence_id TEXT,
  timestamp INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  actor TEXT,
  metadata TEXT,
  FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY NOT NULL,
  timestamp INTEGER NOT NULL,
  action TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  details TEXT NOT NULL,
  hash TEXT NOT NULL
);

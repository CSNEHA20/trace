# TRACE Encrypted Database Specification

## 1. Database Architecture
- **Engine:** `expo-sqlite`
- **Encryption:** AES-256 local database encryption using key material stored in `expo-secure-store`.
- **Primary Schema:** [database/schema/01_initial_schema.sql](file:///f:/SNEHA/IQOO%2726-Trace/database/schema/01_initial_schema.sql)

## 2. Table Schemas

### `cases`
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | TEXT | PRIMARY KEY | Unique Case UUID |
| `case_number` | TEXT | UNIQUE NOT NULL | Human-readable Case ID |
| `title` | TEXT | NOT NULL | Case title |
| `description` | TEXT | | Detailed case description |
| `investigator_name` | TEXT | NOT NULL | Investigator name |
| `status` | TEXT | DEFAULT 'ACTIVE' | Case status |
| `created_at` | INTEGER | NOT NULL | Timestamp ms |
| `updated_at` | INTEGER | NOT NULL | Timestamp ms |

### `evidence_items`
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | TEXT | PRIMARY KEY | Unique Evidence UUID |
| `case_id` | TEXT | FOREIGN KEY | Associated Case ID |
| `title` | TEXT | NOT NULL | Evidence title |
| `type` | TEXT | NOT NULL | IMAGE \| AUDIO \| VIDEO \| DOCUMENT |
| `file_uri` | TEXT | NOT NULL | On-device file URI |
| `sha256_hash` | TEXT | NOT NULL | 64-char Hex SHA-256 hash |
| `signature` | TEXT | NOT NULL | Hardware Ed25519 signature |
| `exif_data` | TEXT | | JSON stringified EXIF payload |
| `ai_analysis` | TEXT | | JSON stringified Gemma/ML Kit output |
| `is_tampered` | INTEGER | DEFAULT 0 | 1 if hash/signature mismatch |

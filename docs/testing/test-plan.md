# TRACE Test Plan

## Overview
This document outlines the comprehensive test strategy for TRACE (Tamper-Resistant AI Case Evidence) forensic evidence management system. The test plan covers unit tests, integration tests, edge cases, privacy validation, and performance benchmarks.

## Test Scope

### Core Modules Under Test
1. **Case Management** - Case creation, retrieval, listing
2. **Evidence Ingestion** - Secure sandbox copy, SHA-256 hashing, duplicate detection, metadata extraction
3. **Cryptographic Integrity** - Hash chain verification, tamper detection, Ed25519 signing
4. **AI Processing** - OCR, EXIF extraction, face detection, Whisper transcription, Gemma inference
5. **Event Clustering** - Timeline reconstruction, incident event classification
6. **Actor Identification** - Cross-evidence entity resolution, identifier matching
7. **Narrative Generation** - AI incident narrative with disclaimers
8. **Incident Report Generation** - PDF/HTML/TXT export with hash manifests
9. **Secure Export** - Encrypted ZIP packages with cryptographic proofs
10. **Office Kit** - DOCX/XLSX/CSV export for court filing

## Test Categories

### Unit Tests (Jest)
- **Location**: `frontend/__tests__/`
- **Coverage Target**: >90% on business logic
- **Modules**:
  - `architecture.test.ts` - Core cryptographic primitives
  - `database.test.ts` - SQLite CRUD, migrations, transactions
  - `evidenceVault.test.ts` - Ingestion pipeline, format validation, edge cases
  - `audioTranscription.test.ts` - Whisper transcription, hash chain
  - `eventClustering.test.ts` - Timeline clustering, event validation
  - `narrativeGeneration.test.ts` - AI narrative, disclaimer validation
  - `incidentReport.test.ts` - Report generation, options, sections
  - `secureExport.test.ts` - Encrypted export, key management
  - `officeKit.test.ts` - DOCX/XLSX/CSV export
  - `integrityLedger.test.ts` - Hash chain verification, tamper detection

### Integration Tests
- Full ingestion → AI → database → report pipeline
- Cross-module data flow validation
- Hash chain continuity across operations
- Evidence → Event → Actor → Narrative → Report chain

### Edge Cases (Tested in Unit Tests)
| Edge Case | Test Location |
|-----------|---------------|
| No internet | All tests run offline |
| No permissions | `evidenceVault.test.ts` - permission denied |
| Empty evidence | `evidenceVault.test.ts` - empty file |
| Corrupt evidence | `evidenceVault.test.ts` - corrupt file |
| Huge evidence | `evidenceVault.test.ts` - 600MB limit |
| Unsupported format | `evidenceVault.test.ts` - .exe rejected |
| Missing metadata | `evidenceVault.test.ts` - no EXIF |
| AI unavailable | `narrativeGeneration.test.ts` - mocked |
| Malformed AI output | `eventClustering.test.ts` - JSON parse errors |
| Interrupted processing | `database.test.ts` - transaction rollback |
| Low storage | `evidenceVault.test.ts` - storage check |
| Duplicate evidence | `evidenceVault.test.ts` - SHA-256 dedup |
| Timestamps missing/conflicting | `eventClustering.test.ts` - timestamp conflicts |

### Privacy Audit Tests
- No HTTP requests in any test
- No cloud API calls
- No evidence data in logs
- No analytics tracking
- Sandbox isolation verified

## Test Execution

### Commands
```bash
# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Run specific test suite
npm test -- --testPathPattern="database"

# Watch mode for development
npm test -- --watch
```

### CI/CD Integration
- Tests run on every PR
- Lint + typecheck must pass before tests
- Coverage threshold: 80% minimum

## Test Data Management
- Fixtures in `tests/fixtures/`
- Mock evidence files generated programmatically
- No real forensic data in repository
- Temporary sandbox directories cleaned after each test

## Acceptance Criteria
- [ ] All 249 tests pass
- [ ] TypeScript compilation clean (`npm run lint`)
- [ ] No privacy violations detected
- [ ] Edge cases covered
- [ ] Performance benchmarks documented
# TRACE — Tamper-Resistant AI Case Evidence

## Project Goal

TRACE is a privacy-first, phone-native AI system for preserving,
organizing, reconstructing, and presenting user-provided digital
evidence related to digital harassment, cyberbullying, blackmail,
threats, impersonation, manipulated media, and similar incidents.

## Core Principle

TRACE does NOT secretly monitor other applications.

Evidence is explicitly provided by the user through legitimate
Android mechanisms such as sharing, importing files, screenshots,
audio/video, documents, and other supported inputs.

## Core Pipeline

User Evidence
→ Evidence Vault
→ Integrity Verification
→ Evidence Extraction
→ Local AI Analysis
→ Event Reconstruction
→ Timeline
→ Evidence Graph
→ Conflict Detection
→ Evidence Gap Detection
→ Report

## Privacy

Sensitive evidence should remain on the user's device whenever
technically feasible.

No cloud database.

No cloud AI dependency for the core workflow.

## Core Features

1. Case management
2. Evidence import
3. Local encrypted evidence storage
4. SHA-256 evidence hashing
5. OCR
6. Audio transcription
7. Evidence metadata extraction
8. Local AI analysis
9. Event extraction
10. Actor/entity extraction
11. Timeline reconstruction
12. Evidence relationships
13. Conflict detection
14. Evidence gap detection
15. Evidence-linked incident summary
16. Privacy review before export
17. PDF report generation
18. Phone-to-laptop workflow using Office Kit

## AI Principle

AI must assist analysis, not replace the original evidence.

Every important AI-generated observation should be traceable to
the evidence that supports it.

The system should express uncertainty rather than invent facts.

For example:

"Potential blackmail indicator detected"

instead of:

"This is definitely blackmail."

## Important Limitations

TRACE does not:

- secretly monitor other apps
- bypass Android security
- guarantee recovery of deleted messages
- determine guilt
- guarantee legal admissibility
- replace law enforcement
- replace lawyers

## Hackathon Requirements

The iQOO phone is the primary build and demo device.

The project should make meaningful use of:

- phone processing
- local/on-device AI
- phone storage
- camera where naturally useful
- microphone/audio where useful
- Office Kit for phone-to-laptop workflow

## Initial MVP

The first implementation target is intentionally small:

Create Case
→ Import Evidence
→ Store Evidence Locally
→ Generate SHA-256
→ Display Evidence

AI will NOT be implemented in the first step.

The application must first have a stable Android foundation.
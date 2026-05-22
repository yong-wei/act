## ADDED Requirements

### Requirement: Submission payloads have one canonical evidence summary
The system SHALL classify submitted response payloads through one shared evidence quality module.

#### Scenario: Manifest objective evidence is rich
- **WHEN** a manifest-submission-v2 payload contains answers, score context, and question summaries
- **THEN** the shared summary marks quality rich and reports answer, score, question summary, and scoreable objective availability

#### Scenario: Score-only manifest evidence remains usable
- **WHEN** a manifest-submission-v2 payload contains a finite numeric score but no durable answer details
- **THEN** the shared summary marks quality partial and reports score availability without reporting answer availability

#### Scenario: Legacy payload is explicit
- **WHEN** a payload is not a supported manifest-submission-v2 evidence envelope
- **THEN** the shared summary marks quality legacy and reports that rich diagnostics are unavailable

### Requirement: Governance consumers use the shared classifier
The system SHALL use the shared classifier in ingestion, reports, data-quality checks, and course evidence backfill.

#### Scenario: Consistent report classification
- **WHEN** the same responseData payload is inspected by event ingestion, session report, and session data-quality report
- **THEN** all consumers return the same quality enum and reason metadata

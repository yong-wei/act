## ADDED Requirements

### Requirement: SAR persists governed retrieval index records
The system SHALL persist SAR retrieval events, entities, event-entity relations, and query traces after the first-stage SAR contract is stable.

#### Scenario: Projection records are persisted
- **WHEN** a governed SAR projection writes events, entities, or event-entity relations
- **THEN** the system SHALL persist stable ids, type, safe summary or label, source reference, authority level, privacy scope, freshness, content hash where available, relation role, relation confidence, relation source, and version refs
- **AND** repeated projection of the same stable SAR ids SHALL update or preserve records idempotently without duplicating relations.

#### Scenario: Query trace is persisted
- **WHEN** a SAR association query is executed for a governed use case
- **THEN** the system SHALL persist query role, use case, student or class scope where permitted, query hash, seed entities, selected events, rejected refs, limitations, version refs, and downstream Source Pack or citation handoff state.

### Requirement: SAR persistence excludes restricted raw content
The system SHALL keep persisted SAR records privacy-safe and citation-boundary aware.

#### Scenario: Restricted evidence reaches persistence
- **WHEN** a SAR event, entity, relation, or trace references learner answers, hidden Arena evaluation internals, private Konling memory, raw audit traces, or audit-only evidence
- **THEN** the persisted record SHALL contain only permitted stable refs, redacted summaries, limitation codes, or rejection metadata
- **AND** raw restricted content SHALL NOT be stored in SAR persistence or exported diagnostics.

### Requirement: SAR query trace retention is minimized
The system SHALL define retention and minimization rules for persisted SAR query traces before storing student-scoped or class-scoped trace history.

#### Scenario: Student-scoped trace is persisted
- **WHEN** a SAR query trace includes student scope, class scope, seed entities, selected refs, or rejected refs
- **THEN** the system SHALL store hash-only query identity instead of raw query text
- **AND** it SHALL attach a retention window, minimization policy, and export eligibility state.

#### Scenario: Trace retention window expires
- **WHEN** a persisted SAR trace reaches its retention or minimization boundary
- **THEN** the system SHALL delete, aggregate, or redact student-scoped trace details according to the retention policy
- **AND** expired or restricted trace details SHALL NOT appear in administrator exports, teacher surfaces, or evaluation reports.

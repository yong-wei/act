## Purpose

Provide safe historical course evidence enrichment and targeted report regeneration without fabricating missing student answers, scores, or correctness data.

## Requirements

### Requirement: Evidence backfill is dry-run first
The system SHALL provide a dry-run mode for course evidence enrichment before any data is written.

#### Scenario: Dry-run writes nothing
- **WHEN** the evidence backfill command runs without an apply flag
- **THEN** it MUST report candidate counts, recoverable counts, unrecoverable counts, affected sessions, and affected users
- **AND** it MUST NOT create, update, or delete evidence, fact, snapshot, report, or raw source rows.

### Requirement: Recoverable evidence is enriched without fabrication
The system SHALL enrich historical course evidence only when submitted answers or final-state answers are recoverable from durable source tables.

#### Scenario: Final-state answer recovery
- **WHEN** a session has final `StudentState.data.responses` for a submitted step whose immutable response payload lacks answers
- **THEN** the backfill MAY enrich derived evidence with those recovered answers
- **AND** it MUST mark the source as final-state-enriched rather than original attempt evidence.

#### Scenario: Missing answer remains legacy
- **WHEN** no durable source contains the submitted answer value
- **THEN** the backfill MUST mark the row as unrecoverable or legacy-only
- **AND** it MUST NOT fabricate answer, score, or correctness data.

### Requirement: Backfill is idempotent and traceable
The system SHALL prevent duplicate enrichment and retain traceability to source records.

#### Scenario: Repeated apply
- **WHEN** the same backfill is applied more than once
- **THEN** later runs MUST NOT duplicate facts or conflicting enrichment records
- **AND** the summary MUST report already-enriched rows separately from newly enriched rows.

### Requirement: Reports can be regenerated for selected sessions
The system SHALL regenerate class and student reports for selected sessions after enrichment.

#### Scenario: Single-session regeneration
- **WHEN** an operator regenerates reports for a specific session id
- **THEN** the system MUST refresh class and student session reports for that session
- **AND** it MUST print evidence coverage before and after regeneration.

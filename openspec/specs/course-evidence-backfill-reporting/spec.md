## Purpose

Provide safe historical course evidence enrichment and targeted report regeneration without fabricating missing student answers, scores, or correctness data.
## Requirements
### Requirement: Evidence backfill is dry-run first
The system SHALL provide a dry-run mode for course evidence enrichment before any data is written. Every apply operation SHALL additionally require a stable operation identity, authorized scope, frozen source cutoff/revision and input digest, and SHALL produce a minimal terminal receipt.

#### Scenario: Dry-run writes nothing
- **WHEN** the evidence backfill command runs without an apply flag or without its authorized operation identity
- **THEN** it MUST report deterministic candidate counts, recoverable counts, unrecoverable counts, affected sessions, affected users and limitations
- **AND** it MUST NOT create, update or delete evidence, fact, snapshot, report, outbox, current pointer or raw source rows

#### Scenario: Apply uses frozen input
- **WHEN** an operator applies an authorized backfill with a stable operation identity and frozen cutoff
- **THEN** the command MUST verify scope, source revision, input digest and retention policy before writing
- **AND** it MUST persist a terminal receipt that records the operation and outcome without raw answers or direct identifiers

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
The system SHALL prevent duplicate enrichment and retain traceability to source records. Each operation SHALL retain per-input accepted, duplicate, invalid, retryable and terminal outcomes, together with its source anchors and receipt identity.

#### Scenario: Repeated apply
- **WHEN** the same backfill is applied more than once with the same operation identity and frozen input
- **THEN** later runs MUST resume or verify existing outcomes without duplicating facts or conflicting enrichment records
- **AND** the summary MUST report already-processed, newly processed and unresolved rows separately

#### Scenario: Input or receipt drifts
- **WHEN** a retry supplies a different source revision, cutoff, digest or operation scope
- **THEN** the command MUST fail closed with a minimized diagnostic receipt
- **AND** it MUST preserve the original operation and source records

### Requirement: Reports can be regenerated for selected sessions
The system SHALL regenerate class and student reports for selected sessions after enrichment.

#### Scenario: Single-session regeneration
- **WHEN** an operator regenerates reports for a specific session id
- **THEN** the system MUST refresh class and student session reports for that session
- **AND** it MUST print evidence coverage before and after regeneration.


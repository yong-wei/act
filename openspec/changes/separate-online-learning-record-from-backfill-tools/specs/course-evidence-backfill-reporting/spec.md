## MODIFIED Requirements

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

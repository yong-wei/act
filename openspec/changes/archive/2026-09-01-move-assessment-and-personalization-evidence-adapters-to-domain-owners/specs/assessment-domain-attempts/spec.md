## ADDED Requirements

### Requirement: Assessment owns assessment-to-evidence adapters
Assessment SHALL own the mapping from durable assessment attempts, scoring and review/provisional state to normalized Learning Record evidence. The adapter SHALL use the existing Assessment public/application API and canonical Learning Record writer; `data-governance` business code MUST NOT become a second assessment authority.

#### Scenario: Reviewed attempt is finalized
- **WHEN** a durable Assessment attempt is scored under a reviewed item snapshot
- **THEN** Assessment SHALL produce the normalized evidence with item, scoring, objective, revision and provenance references
- **AND** it SHALL request one canonical Learning Record write without copying raw answer bodies or full question text

#### Scenario: Provisional attempt is finalized
- **WHEN** an item is generated, under-reviewed or otherwise provisional
- **THEN** Assessment SHALL preserve provisional status and degraded confidence in the adapter output
- **AND** it SHALL not grant high-confidence mastery, readiness, checkpoint or terminal validation

### Requirement: Assessment adapter migration preserves durable attempt behavior
Moving an Assessment evidence adapter SHALL preserve server-derived identity, immutable item snapshots, idempotent action identity, concurrency ordering, response compatibility and same-transaction/outbox semantics already defined by the Assessment and Learning Record contracts.

#### Scenario: Assessment submission is retried
- **WHEN** the same session/item/action is submitted again with identical input
- **THEN** the owner adapter SHALL return the original evidence/result or a deterministic duplicate outcome
- **AND** it SHALL not create another answer, mastery update, LearningFact or projection trigger

#### Scenario: Adapter receives a forged identity
- **WHEN** a request supplies another learner, path, item, scope or revision
- **THEN** the Assessment public API SHALL reject it before scoring or evidence persistence
- **AND** the adapter SHALL not fall back to client or route payload values

# assessment-domain-attempts Specification

## Purpose
TBD - created by archiving change cutover-path-owned-assessment-attempts. Update Purpose after archive.
## Requirements
### Requirement: Assessment domain exposes one path-owned attempt use case

Assessment domain SHALL expose public use cases for selecting a path-owned question, submitting an answer, reading attempt context and reading assessment results. Routes, path consumers and personalization consumers MUST depend on that public contract rather than route handlers, `adaptive-engine` internals, or persistence adapters.

#### Scenario: Path question is requested

- **WHEN** an authenticated learner requests the next item for the current path node
- **THEN** the use case SHALL resolve the server-owned path, node, goal, stage, catalog revision and learner history
- **AND** it SHALL select a reviewed catalog item and persist its immutable session/item reference before returning the student-safe question.

#### Scenario: Path answer is submitted

- **WHEN** an authenticated learner submits an answer for a path-owned item reference
- **THEN** the use case SHALL verify ownership and current node, score the immutable snapshot, update only eligible mastery, and materialize the governed LearningFact
- **AND** the route SHALL not perform a second path-context parse or direct persistence write.

### Requirement: Path assessment identity is server-derived and immutable

The Assessment use case MUST derive learner, path, node, goal, session and catalog identity from authenticated server state and persisted records. Client-supplied identity or question metadata SHALL be treated as an untrusted hint and MUST NOT replace the stored snapshot.

#### Scenario: Client forges another path reference

- **WHEN** a request supplies a path, node, goal, session or item reference not owned by the authenticated learner or not current for the path
- **THEN** the use case SHALL fail closed before scoring or writing evidence
- **AND** no answer, mastery update or LearningFact SHALL be created.

#### Scenario: Catalog metadata changes after selection

- **WHEN** catalog metadata, review state or stage policy changes after an item was selected
- **THEN** the answer SHALL continue to use the immutable selection-time snapshot
- **AND** new selections SHALL use the current reviewed catalog identity without mutating historical refs.

### Requirement: Durable attempts are idempotent and concurrency-safe

The Assessment domain SHALL persist session asked state, item refs, answers, score, mastery update and LearningFact identity through one durable protocol. Retries with the same action identity MUST return the original result; conflicting reuse MUST return a conflict; concurrent next-question and submit operations MUST not duplicate or reorder authoritative state silently.

#### Scenario: Answer submission is retried

- **WHEN** the same learner submits the same session/item/action again with identical input
- **THEN** the use case SHALL return the existing durable answer and result
- **AND** it SHALL not append a duplicate answer, mastery update or LearningFact.

#### Scenario: Next-question requests race

- **WHEN** concurrent requests select the next item for one durable session
- **THEN** the use case SHALL serialize or retry against the latest persisted asked set
- **AND** it SHALL not return the same uncompleted item twice while an eligible unasked item exists.

### Requirement: In-memory assessment state is not an authority

Path-owned Assessment behavior MUST NOT read or write `globalThis`, process-local `Map` state, or a disabling persistence flag as a fallback authority. Existing `Question` and `UserAnswer` tables MAY remain adapters for other domains, but new path-owned writes SHALL use the Assessment durable contract.

#### Scenario: Persistence adapter is unavailable or legacy flag is false

- **WHEN** durable Assessment storage cannot be used or the retired persistence flag is present
- **THEN** the path-owned use case SHALL return an explicit unavailable/retry state or fail closed
- **AND** it SHALL not fall back to `adaptive-engine` process memory.

#### Scenario: Legacy table remains in use elsewhere

- **WHEN** a non-Assessment domain still reads an old `Question` or `UserAnswer` table
- **THEN** the migration SHALL preserve that table and its read contract
- **AND** it SHALL not preserve a second path-owned Assessment authority merely for compatibility.

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



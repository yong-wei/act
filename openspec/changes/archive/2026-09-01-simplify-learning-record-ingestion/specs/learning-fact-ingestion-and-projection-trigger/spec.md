## ADDED Requirements

### Requirement: Ingestion simplification retains one canonical behavior
The canonical Learning Record ingestion implementation SHALL express normalization, authority/quality validation, anchor/time resolution, allowlist sanitization, deduplication, persistence and projection-trigger derivation through one behaviorally equivalent pipeline. Direct and staged/outbox transport MAY differ only at their transport boundary.

#### Scenario: Direct and outbox inputs are equivalent
- **WHEN** the same trusted logical input is delivered synchronously and through staging
- **THEN** both paths SHALL produce the same normalized identity, input/trusted-set digest, anchors, status and effective trigger
- **AND** neither path SHALL create a second fact or trigger

#### Scenario: Duplicate and conflicting replay is simplified
- **WHEN** an already applied identity is replayed identically or with a different immutable payload
- **THEN** the pipeline SHALL retain the existing deterministic duplicate or collision result
- **AND** it SHALL not weaken conflict detection or double-count state

### Requirement: Simplification preserves reliable transaction and outbox delivery
Refactoring or deleting ingestion helpers MUST preserve fact-plus-trigger transaction semantics, non-destructive recoverability, lease/ack ordering, retryable/terminal outcomes and append-only history.

#### Scenario: Worker crashes before acknowledgement
- **WHEN** a staged input is claimed and the worker crashes before fact and trigger intent commit or acknowledgement
- **THEN** the input SHALL remain recoverable for retry
- **AND** a replay SHALL converge by stable dedupe without losing or duplicating the fact

#### Scenario: Validation fails after simplification
- **WHEN** authority, privacy, revision, time or persistence validation rejects an input
- **THEN** the pipeline SHALL return the same minimized failure class and receipt behavior as before
- **AND** it SHALL not persist a partial fact or silently drop the input

### Requirement: Ingestion simplification is characterized before obsolete paths are deleted
Every implementation simplification SHALL have before/after evidence covering outputs, errors, side effects, ordering, anchors, trusted/server times, privacy, retention and backfill isolation. Code MUST NOT be removed solely because it is longer or appears duplicated.

#### Scenario: Candidate helper has an independent compatibility role
- **WHEN** before analysis shows a parser or guard handles a distinct schema/version, authority or audit boundary
- **THEN** the helper SHALL remain an explicit adapter or the change SHALL be deferred
- **AND** the simplification SHALL not merge away that behavior

#### Scenario: Candidate helper is proven redundant
- **WHEN** call graph, tests and runtime canaries show a helper adds no distinct behavior and has no required caller
- **THEN** it MAY be deleted after equivalent tests pass
- **AND** the final evidence SHALL show a net reduction in duplicate paths without a new facade

## ADDED Requirements

### Requirement: Future-child records are exact and dependency-complete
Every record SHALL contain the shared discriminated schema, typed `exact_items`, exact count, applicable owner and endpoint blocks, change-ID `blockedBy`, source/governance/snapshot/upstream digests, required outputs, acceptance profile, and scope anchors. Placeholders, wildcards, count-only queues, waivers, and stale split closures SHALL fail.

#### Scenario: An endpoint child is missing from blockedBy
- **WHEN** a cross-block record references the endpoint
- **THEN** validation SHALL fail before stage-two proposal.

### Requirement: Cutover readiness uses the bounded input contract
The cutover record SHALL contain exact items for new projection import, reviewed active legacy-to-canonical mappings, active-reference migration, legacy revision/snapshot compatibility, and post-cutover new-fact revision binding. Active references SHALL include only current course/resource/progress/note and incomplete-path uses.

#### Scenario: A completed path is proposed for migration
- **WHEN** the path has no current reader or continued execution
- **THEN** validation SHALL reject it from active-reference inputs.

### Requirement: Historical facts stay on their original revision
Existing facts, events, diagnoses, portraits, risks, growth, recommendations, class aggregates, Arena records, and completed paths SHALL NOT be replayed, deduplicated, reinterpreted, or backfilled into the new graph. Missing historical revisions SHALL resolve only through `legacy-unversioned` or a legacy snapshot.

#### Scenario: A readiness record requests historical fact backfill
- **WHEN** the validator encounters that item
- **THEN** validation SHALL fail because it violates the cutover scope.

### Requirement: New facts bind the single active new revision
Every fact written after cutover SHALL atomically persist exactly one active new graph revision. Missing or multiple revisions SHALL reject the new write.

#### Scenario: A post-cutover producer omits the revision
- **WHEN** it attempts to persist a new fact
- **THEN** the write-boundary gate SHALL fail.

### Requirement: Historical diagnostics are outside the series
The validator SHALL NOT generate, consume, or validate historical decoder closure, producer lineage, polymorphic source-ID resolution, evidence deduplication, learner-derived-state reconciliation, or full-root writer equality.

#### Scenario: A historical decoder input is supplied
- **WHEN** an input declares a historical decoder shape or catalog
- **THEN** the validator SHALL reject it as out of scope without decoding, cataloging, or producing a readiness finding.

### Requirement: Validation is deterministic and read-only
The validator SHALL reconcile exact items, ownership, endpoints, dependency closure, acceptance profiles, scope anchors, and digest freshness deterministically and SHALL NOT create changes or mutate governed sources.

#### Scenario: Validation succeeds
- **WHEN** all preparation records and bounded cutover items pass
- **THEN** one exact future-series manifest SHALL be emitted
- **AND** stage-two creation SHALL remain a separate proposal action.

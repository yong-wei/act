## ADDED Requirements

### Requirement: The parent is tracking-only with eight executable children
The parent SHALL track exactly the eight child change IDs declared in its proposal. Each child SHALL own one manifest capability, use the indexed decision-source contract, and remain independently executable after its `blockedBy` change IDs are complete.

#### Scenario: Series shape is validated
- **WHEN** parent and child metadata are checked
- **THEN** exactly eight unique child change IDs SHALL be present
- **AND** the parent SHALL contain no generator, migration, runtime, or cutover implementation task.

### Requirement: Stage two waits for a frozen exact owner manifest
The series SHALL NOT create a stage-two parent or child until every stage-one output is complete, independently reviewed, digest-current, and accepted by the closeout manifest validator.

#### Scenario: Stage-one tracking completes
- **WHEN** all eight children report completion
- **THEN** readiness SHALL still require placeholder-free typed `exact_items`, owner applicability, cross-block endpoints, dependency closure, and source drift clearance
- **AND** prototype names, block counts, snapshot cardinalities, or waivers SHALL NOT establish readiness.

### Requirement: Stage one is read-only
Stage-one deliverables SHALL be manifests, reports, a new read-only manifest CLI, and tests. They SHALL NOT mutate authoring, runtime projections, databases, GitHub objects, or production behavior.

#### Scenario: A child CLI is exercised
- **WHEN** the child runs against a fixed snapshot
- **THEN** no-write assertions SHALL prove that all governed sources and external systems remain unchanged.
### Requirement: Series tracking preserves the bounded knowledge-rebuild scope
The parent SHALL preserve the existing eight-child topology and SHALL NOT generate, consume, or validate historical fact/event replay, backfill, learner-derived-state reconciliation, full-history decoder closure, or full-root writer equality.

#### Scenario: A child supplies a historical input
- **WHEN** parent metadata is validated
- **THEN** validation SHALL reject the input as out of scope without cataloging it or changing the dependency graph.

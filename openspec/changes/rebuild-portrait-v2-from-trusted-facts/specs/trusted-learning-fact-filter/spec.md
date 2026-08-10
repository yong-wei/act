## ADDED Requirements

### Requirement: Trusted LearningFact determination is versioned and evidence-anchored

The system SHALL determine whether a LearningFact is trusted for Portrait v2 by applying the active versioned `trusted-learning-fact-policy` to existing server-side evidence anchors. Trust SHALL NOT be represented by a new `trusted` boolean field and SHALL NOT be assigned retroactively by an application-side marker.

#### Scenario: Fact has no source event anchor
- **WHEN** a LearningFact has an empty or missing `sourceEventId`
- **THEN** the fact SHALL be classified as not trusted for Portrait v2

#### Scenario: Fact originates from a known non-trusted prefix
- **WHEN** `sourceEventId` starts with a policy-declared non-trusted prefix such as `historical:`, `interaction-log:`, `yangfan-diagnostic-fixture:`, `backfill:`, or `recompute:`
- **THEN** the fact SHALL be classified as not trusted for Portrait v2

#### Scenario: Simulation agent fact has a server-side log anchor
- **WHEN** `sourceEventId` starts with `simulation-agent-evidence:` and `sourceLogId` is non-empty
- **THEN** the fact MAY be classified as trusted for Portrait v2

#### Scenario: Simulation agent fact lacks a server-side log anchor
- **WHEN** `sourceEventId` starts with `simulation-agent-evidence:` and `sourceLogId` is empty or missing
- **THEN** the fact SHALL be classified as not trusted for Portrait v2

#### Scenario: Producer prefix is not sufficient by itself
- **WHEN** a fact has a producer or source prefix that appears in the controlled producer inventory
- **THEN** the producer prefix SHALL NOT override a failed evidence-anchor check
- **AND** the fact SHALL remain not trusted unless every policy rule is satisfied

### Requirement: Portrait materialization applies one trusted fact filter

The system SHALL apply the same trusted LearningFact filter inside Portrait v2 materialization before facts enter the transition journal. Full rebuilds, incremental updates, and legacy compatible snapshot materialization SHALL use the same filter and SHALL NOT re-admit previously excluded facts because of a different entry point.

#### Scenario: Full rebuild processes mixed facts
- **WHEN** a learner has both trusted and non-trusted LearningFacts
- **THEN** only trusted facts SHALL be written into the learner fact transition sequence and used for portrait evidence

#### Scenario: Incremental update follows a rebuild
- **WHEN** a new trusted LearningFact arrives after a full rebuild
- **THEN** the incremental materializer SHALL apply the same filter to the complete eligible fact set
- **AND** it SHALL NOT absorb previously excluded non-trusted facts into the portrait

#### Scenario: Legacy compatible snapshot is materialized
- **WHEN** `materializeLegacyCompatibleSnapshot` runs for a learner
- **THEN** it SHALL consume the same trusted fact filter
- **AND** it SHALL NOT derive compatible portrait values from non-trusted facts

#### Scenario: Trust anchors survive serialization and correction
- **WHEN** a trusted fact is serialized, cloned, or reconstructed through a `CORRECT` transition
- **THEN** `sourceEventId`, `sourceLogId`, and `knowledgeRevisionRef` SHALL be preserved
- **AND** the rebuilt fact SHALL retain its trust classification

### Requirement: Portrait rebuild is versioned, deterministic, and non-destructive

The system SHALL rebuild existing Portrait v2 records from trusted facts under an explicit calculation version and trusted fact policy version. Rebuild SHALL preserve old snapshots and LearningFacts, SHALL NOT delete or mutate historical evidence, and SHALL advance the current pointer only through the existing atomic publish mechanism.

#### Scenario: Calculation version changes
- **WHEN** the active Portrait v2 calculation version or trusted fact policy version changes
- **THEN** affected learners SHALL be scheduled for full rebuild from trusted facts
- **AND** the rebuild SHALL append a new snapshot or `NO_EVIDENCE` state while preserving prior snapshots

#### Scenario: Rebuild is repeated with the same input
- **WHEN** the same trusted fact set, trusted fact policy version, calculation version, and as-of window are materialized twice
- **THEN** the trusted fact id set, input digest, and portrait payload digest SHALL be identical
- **AND** repeated execution SHALL NOT create a new logical current state

#### Scenario: Historical data is retained
- **WHEN** rebuild excludes non-trusted facts
- **THEN** the original LearningFacts and all prior Portrait snapshots SHALL remain stored for audit
- **AND** they SHALL NOT be exposed as the current trusted portrait

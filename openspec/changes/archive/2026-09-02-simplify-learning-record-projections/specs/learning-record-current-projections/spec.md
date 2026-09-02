## MODIFIED Requirements

### Requirement: Facts, snapshots and read models are distinct
LearningFact SHALL remain the append-only evidence input. Immutable snapshots SHALL represent a qualified calculation version, while one declared role-specific current read model and current pointer SHALL be the online projection authority. Raw events MUST NOT be the normal source for a student, teacher, AI or Personalization page response, and a simplification MUST NOT introduce another projection authority.

#### Scenario: Read model is rebuilt
- **WHEN** a projection is rebuilt from its recorded fact watermark
- **THEN** its output is derived from governed LearningFacts and its revision/provenance is retained
- **AND** normal consumers continue to read the declared current read model rather than a second aggregation

#### Scenario: Online and historical code are separated
- **WHEN** an online projection request is served
- **THEN** it SHALL use the current projection/read port
- **AND** it SHALL not import, invoke or read the working state of a backfill operation

### Requirement: Failure preserves qualified current
Projection failure, stale input, insufficient evidence, unavailable dependency or conflict SHALL preserve the previous qualified current and expose an explicit status/reason. If no qualified current exists, the read port SHALL return unavailable rather than scanning raw events, invoking backfill or fabricating zero values.

#### Scenario: Refresh crashes before pointer commit
- **WHEN** a worker crashes after writing a candidate version but before pointer publication
- **THEN** the prior qualified current remains visible and the candidate is retryable or marked failed

#### Scenario: Current becomes stale
- **WHEN** a newer fact exists but refresh has not qualified a replacement
- **THEN** the read port reports stale/partial metadata and does not present the previous value as fresh

#### Scenario: Backfill cannot repair an online read
- **WHEN** an online request has no qualified current projection
- **THEN** it returns the governed unavailable/stale status
- **AND** it does not invoke a historical tool or move the current pointer

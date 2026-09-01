## ADDED Requirements

### Requirement: Online consumers use one qualified current projection path
Student, Teacher, AI and Personalization normal runtime SHALL read the existing revision/generation/watermark-qualified current projection through role-safe ports. Raw events/facts, legacy snapshots and undeclared caches MUST NOT be used as an online fallback when the current projection is stale, partial or unavailable.

#### Scenario: Qualified current is available
- **WHEN** a role-authorized consumer requests current learning evidence
- **THEN** the service SHALL return the qualified current projection with its revision, generation, watermark, coverage, freshness and confidence
- **AND** it SHALL not scan raw events or reconstruct a second projection

#### Scenario: Current projection is unavailable
- **WHEN** no qualified current pointer satisfies the requested scope or revision
- **THEN** the read port SHALL return explicit stale/partial/unavailable status and permitted limitations
- **AND** the consumer SHALL not label raw fallback data as current

### Requirement: Projection simplification preserves qualification and pointer fences
Any simplification of projection builders, caches or read orchestration SHALL preserve immutable snapshots, candidate qualification, atomic fenced current-pointer publication, previous qualified current retention, role-minimum fields and deterministic input/output digests.

#### Scenario: Candidate input is incomplete
- **WHEN** a candidate lacks trusted evidence, matching revision, digest, coverage or authority
- **THEN** it SHALL remain unqualified and MUST NOT become current after simplification
- **AND** the prior qualified current, if any, SHALL remain readable

#### Scenario: Same facts are projected twice
- **WHEN** the same governed fact set is processed in different order or through a retry
- **THEN** the simplified projection SHALL retain the same ordered input digest, output digest, watermark and status
- **AND** it SHALL not create a duplicate current version

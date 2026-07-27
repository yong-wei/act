## ADDED Requirements

### Requirement: Domain output is a candidate manifest, not a final vocabulary
The manifest SHALL emit flat domain candidates with stable candidate IDs, unique proposed names, definitions, inclusion and exclusion boundaries, source evidence, and review status. It SHALL NOT set a permanent candidate count or approve final domains.

#### Scenario: Seed evidence is loaded
- **WHEN** the versioned audit provides a proposed seed set
- **THEN** seeds SHALL be recorded as candidate evidence
- **AND** their observed count SHALL NOT become a specification invariant.

### Requirement: Dimension pollution receives explicit review records
Every observed label SHALL be classified as semantic-domain candidate, course/module structure, navigation/topic filter, or invalid/unknown, with a deterministic review disposition and provenance.

#### Scenario: A module label is observed
- **WHEN** the label describes course organization rather than subject semantics
- **THEN** it SHALL enter the dimension-pollution review list
- **AND** it SHALL NOT become a domain solely from current metadata.

### Requirement: Candidate derivation does not assign concepts
Domain candidate records SHALL exclude concept membership, owner blocks, hierarchy, and approved migration outcomes.

#### Scenario: A candidate record contains concept membership
- **WHEN** schema validation runs
- **THEN** validation SHALL fail.

### Requirement: Domain candidate output is reproducible and digest-bound
The manifest SHALL include `schema_version`, `algorithm_version`, `normalization_profile`, structured `source_digests`, `governance_contract_digest`, `source_snapshot_digest`, and structured `upstream_manifest_digests`, and SHALL report expected/observed drift without fixing observed counts.

#### Scenario: Input order changes without semantic drift
- **WHEN** the same normalized inventory is processed twice
- **THEN** the candidate manifest SHALL be byte-identical.
### Requirement: Domain derivation uses current governed truth
Domain candidates SHALL derive only from current formal-course anchors and current authoring sources. Historical facts, events, learner-derived state, and inactive legacy references SHALL NOT affect the candidate set or readiness.

#### Scenario: A historical diagnosis contains a domain label
- **WHEN** domain candidates are derived
- **THEN** the label SHALL be ignored as non-authoritative historical evidence.

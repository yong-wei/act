## ADDED Requirements

### Requirement: Identity equivalence components use only hard equivalence evidence
The manifest SHALL form globally closed identity equivalence components only from exact normalized names and reviewed controlled aliases. Every source concept SHALL belong to exactly one component with a stable `component_id`; components SHALL be indivisible during partitioning and SHALL NOT contain `owner_block` before partitioning.

#### Scenario: Exact normalized names appear in separate components
- **WHEN** two records with the same normalized name would receive different component IDs
- **THEN** validation SHALL fail.

#### Scenario: A pre-partition owner is emitted
- **WHEN** an identity component contains `owner_block`
- **THEN** validation SHALL fail because partitioning first assigns block ownership.

### Requirement: Near-similar evidence is a review edge between components
Lexical, vector, or agent similarity SHALL produce a versioned near-similar review edge connecting two different components. It SHALL NOT merge components or assign block ownership.

#### Scenario: Near-similar concepts are detected
- **WHEN** similarity evidence passes the candidate threshold
- **THEN** one deterministic review edge SHALL enter the queue
- **AND** both components SHALL remain distinct pending review.

### Requirement: Pending split remains an internal component disposition
A possible split SHALL be represented as pending review within its current component and SHALL NOT pre-split membership, historical evidence, or migration results.

#### Scenario: One source may contain multiple concepts
- **WHEN** split evidence is recorded
- **THEN** the component SHALL retain one stable component ID and unresolved alternatives
- **AND** historical evidence SHALL NOT be copied to proposed outputs.

### Requirement: Scope anchors remain evidence until semantic review
Each component SHALL reference inventoried `course-scope-anchor/v1` records of type `formal_objective`, `necessary_prerequisite`, or `explicit_extension` when available, or an explicit missing-evidence record. Every reference SHALL resolve to an anchor containing stable `anchor_id`, `anchor_scope`, course/module/lesson identities, source locator, and text digest. Course scope SHALL have null module and lesson identities, module scope SHALL have a required module and null lesson identity, and lesson scope SHALL require both identities. Stage one SHALL NOT extract new anchors or approve formal-course admission.

#### Scenario: A candidate lacks anchor evidence
- **WHEN** no inventoried anchor source can be referenced
- **THEN** the component SHALL carry an unresolved scope-anchor finding
- **AND** it SHALL NOT be silently admitted or rejected.

#### Scenario: A referenced anchor violates its scope matrix
- **WHEN** an identity component references an anchor whose scope and nullable module/lesson identities disagree
- **THEN** identity derivation SHALL fail before emitting the component as current.

### Requirement: Identity candidate output is reproducible and digest-bound
The manifest SHALL include `schema_version`, `algorithm_version`, `normalization_profile`, structured `source_digests`, `governance_contract_digest`, `source_snapshot_digest`, and structured `upstream_manifest_digests`, and SHALL emit expected/observed drift without treating observed cardinalities as constants.

#### Scenario: The inventory digest changes
- **WHEN** identity derivation compares the bound upstream digest
- **THEN** readiness SHALL fail before components or review edges are serialized as current.
### Requirement: Legacy mapping candidates are active-reference only
The manifest SHALL include legacy-to-canonical mapping candidates only when a reviewed legacy ID is still used by a current course, resource, progress, note, or incomplete path. It SHALL NOT remap historical facts, events, or completed paths.

#### Scenario: A legacy ID appears only in a historical fact
- **WHEN** identity candidates are derived
- **THEN** that occurrence SHALL remain on its original or legacy revision
- **AND** it SHALL NOT create a migration mapping candidate.

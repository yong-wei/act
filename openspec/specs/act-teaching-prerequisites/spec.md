## Purpose
ACT-owned core teaching-node denominator and versioned ACT_TEACHING prerequisite publication contract.
## Requirements
### Requirement: Core teaching nodes have an explicit bounded denominator
The system MUST derive core teaching nodes only from formal course objectives, primary `COVERS` bindings, prerequisite endpoints, or explicit teacher curation. Each core node MUST declare scope, `pathEligible`, `cardPolicy`, module, and rationale.

#### Scenario: Upstream-only node is present
- **WHEN** a Canonical node exists in ActKG or is mentioned by a textbook but is not selected by an ACT source
- **THEN** it SHALL remain outside the core-node denominator
- **AND** it SHALL not create a prerequisite or path gate

#### Scenario: Core node is selected
- **WHEN** an objective, primary resource binding, prerequisite endpoint, or teacher decision selects a valid Canonical ID
- **THEN** the core-node record SHALL retain its source evidence and explicit path/card policy

### Requirement: Published prerequisites are ACT_TEACHING direct edges
Every published teaching prerequisite MUST use `layer: ACT_TEACHING`, `relationType: PREREQUISITE`, strength `REQUIRED` or `RECOMMENDED`, a declared scope, and at least one ACT evidence reference or teacher-curation rationale. Direct edges are stored; closure/order are deterministic derived views.

#### Scenario: Required edge has evidence
- **WHEN** two current core nodes have an authored evidence-backed dependency
- **THEN** the builder SHALL publish one direct `REQUIRED` edge with curator/source provenance

#### Scenario: Engineering relation is the only candidate
- **WHEN** an ActKG `association`, `derived_from`, `has_component`, or other engineering relation has no ACT teaching evidence
- **THEN** it SHALL remain a candidate and MUST NOT publish as a teaching prerequisite

### Requirement: Required prerequisite graph is acyclic and endpoint-closed
The prerequisite builder MUST reject self-loops, dangling or out-of-scope endpoints, duplicate conflicting identities, and cycles in `REQUIRED` edges. `RECOMMENDED` edges MUST NOT be treated as hard path blockers.

#### Scenario: Required cycle is introduced
- **WHEN** a proposed REQUIRED edge closes a directed cycle
- **THEN** prerequisite publication SHALL fail closed
- **AND** the prior valid prerequisite artifact SHALL remain unchanged

#### Scenario: Recommended edge is present
- **WHEN** a valid RECOMMENDED edge exists without a REQUIRED path
- **THEN** it MAY appear in advisory topology
- **AND** path eligibility SHALL not require it as a hard dependency

### Requirement: Prerequisite evidence is reviewable and immutable
Published edges MUST bind the current Authority/projection identity, authoring revision, evidence refs or curator decision, and deterministic edge digest. A later build MUST preserve prior evidence or emit a new version rather than mutate a published edge in place.

#### Scenario: Evidence source drifts
- **WHEN** an evidence path, Canonical identity, or Authority release changes
- **THEN** the affected edge SHALL become stale/review-required
- **AND** unrelated edges SHALL retain their prior digest

### Requirement: Classical-control prerequisite increment is scope-bounded
The classical-control teaching increment MUST limit its denominator to explicitly selected core nodes in root locus, frequency-domain analysis and classical control design and MUST preserve partial coverage as a non-blocking publication state.

#### Scenario: Some classical candidates remain pending
- **WHEN** the accepted direct edges are endpoint-closed and acyclic but other candidates remain pending
- **THEN** the valid fragment MAY publish with partial coverage
- **AND** pending candidates SHALL not be represented as published edges

### Requirement: Foundation prerequisite increment is scope-bounded
The foundation teaching increment MUST limit its denominator and publication to explicitly selected core nodes in system modeling, time-domain analysis and stability analysis. Unselected Authority objects MUST remain outside the coverage denominator.

#### Scenario: Unselected foundation object exists
- **WHEN** the Authority contains a foundation-domain object not selected by an ACT objective, binding, prerequisite endpoint or curator
- **THEN** it SHALL remain not projected
- **AND** it SHALL not block publication of the reviewed increment

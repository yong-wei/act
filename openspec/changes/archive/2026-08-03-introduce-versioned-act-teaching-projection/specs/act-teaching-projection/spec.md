## ADDED Requirements

### Requirement: Teaching Projection is an ACT-owned versioned artifact
The system MUST build the Teaching Projection from ACT authoring inputs and MUST bind every runtime artifact to one `projectionId`, authoring revision, Authority release identity, source hash set, and deterministic `projectionHash`. Runtime projection files MUST be read-only generated outputs.

#### Scenario: Identical authoring is rebuilt
- **WHEN** identical authoring, Authority identity, and builder version are processed twice
- **THEN** all projection artifacts and `projectionHash` SHALL be byte-identical

#### Scenario: Authoring/runtime identity drifts
- **WHEN** a runtime artifact does not match its manifest source or projection hash
- **THEN** the projection SHALL be rejected before activation

### Requirement: Resource bindings use stable roles and identities
Every binding MUST use a deterministic resource ID, Canonical ID, one of `COVERS`, `EXPLAINS`, `PRACTICES`, or `ASSESSES`, and an explicit teaching scope. Binding identity MUST be derived from `resourceId + canonicalId + role + scopeId` and MUST NOT mutate ActKG objects or predicates.

#### Scenario: Lesson step is projected
- **WHEN** a step authoring record names a valid Canonical ID and `PRACTICES`
- **THEN** the runtime binding SHALL preserve the exact role, scope, source path, and identities

#### Scenario: Unsupported role is supplied
- **WHEN** authoring uses an unknown role or malformed resource ID
- **THEN** projection build SHALL fail closed without replacing the prior release

### Requirement: Projection modes define local gate scope
Every in-scope resource MUST declare `REQUIRED`, `OPTIONAL`, or `NONE`. A `REQUIRED` resource MUST have a valid binding; `OPTIONAL` and `NONE` MUST NOT be treated as missing-knowledge failures.

#### Scenario: Required resource is unbound
- **WHEN** a `REQUIRED` resource has no valid binding
- **THEN** the affected projection SHALL be `REVIEW_REQUIRED` and SHALL NOT activate

#### Scenario: Optional or none resource is unbound
- **WHEN** an `OPTIONAL` or `NONE` resource has no binding
- **THEN** the projection MAY publish if all other gates pass
- **AND** the resource SHALL remain explicitly represented in diagnostics

### Requirement: Projection gate is fail-closed and scope-limited
The gate MUST reject invalid Canonical IDs, retired nodes without a successor, unresolved required card references, duplicate active cards per Canonical ID, dangling prerequisite endpoints, self-loops, or required cycles. It MUST NOT include unprojected Authority nodes in its denominator.

#### Scenario: Authority contains unrelated nodes
- **WHEN** a valid Authority release contains nodes not referenced by any ACT resource/core-node record
- **THEN** those nodes SHALL be `NOT_PROJECTED`
- **AND** projection publication SHALL not be blocked by them

### Requirement: Consumer activation records independent combinations
The activation manifest MUST map each consumer to an explicit Authority release and, when required, Projection ID. Consumers MAY pin different valid combinations, and Engineering-only consumers MAY omit a Projection.

#### Scenario: Engineering consumer activates first
- **WHEN** an Authority snapshot is valid and no Teaching Projection exists
- **THEN** the Engineering Graph/RAG combination MAY become ready
- **AND** teaching consumers SHALL remain `NOT_PROJECTED` or pinned to their prior combination

#### Scenario: Empty projection is built
- **WHEN** ACT has no selected teaching resources
- **THEN** an empty Projection SHALL be legal and receive a deterministic manifest/hash

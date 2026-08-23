# act-teaching-projection Specification

## Purpose
TBD - created by archiving change introduce-versioned-act-teaching-projection. Update Purpose after archive.
## Requirements
### Requirement: Teaching Projection is an ACT-owned versioned artifact
The system MUST build the Teaching Projection from ACT authoring and governance inputs and MUST bind every runtime artifact to one `projectionId`, authoring revision, Authority release identity, course active-domain scope hash, source hash set, qualified pipeline receipts, three-family disposition set, published edge counts, pending counts, review-pack hash, and deterministic `projectionHash`. Runtime projection files MUST be read-only generated outputs. Relation governance state SHALL distinguish truthful `PARTIAL` from complete coverage while runtime edge files contain only admitted relations.

#### Scenario: Identical authoring is rebuilt
- **WHEN** identical authoring, Authority identity, active-domain scope, decisions, qualification receipts, source hashes, and builder version are processed twice
- **THEN** all projection artifacts, governance receipt, review-pack binding, and `projectionHash` SHALL be byte-identical

#### Scenario: Authoring/runtime identity drifts
- **WHEN** a runtime artifact, scope, decision set, qualification receipt, or review-pack hash does not match its manifest source or projection hash
- **THEN** the projection SHALL be rejected before activation

#### Scenario: Other teaching families remain pending
- **WHEN** containment is complete but admitted prerequisite or association work is not complete
- **THEN** the projection MAY be formal only as `PARTIAL` when all other gates pass
- **AND** its governance receipt SHALL preserve the real per-family counts without exposing pending items in runtime relation files

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
The gate MUST reject invalid Canonical IDs, retired nodes without a successor, unresolved required card references, duplicate active cards per Canonical ID, dangling relation endpoints, self-loops, required cycles, unqualified automatic pipelines, invalid item-level admission, mixed Authority or scope identity, or a non-empty active-domain scope with any incomplete containment disposition. Relation governance MUST include every Canonical Object in the exact sealed course active-domain scope even when the object has no resource binding. It MUST NOT include unrelated Authority nodes, root navigation projections, or browser-loaded subsets in that denominator.

#### Scenario: Authority contains unrelated nodes
- **WHEN** a valid Authority release contains nodes outside the sealed course active-domain selection
- **THEN** those nodes SHALL remain outside this course relation denominator
- **AND** relation publication SHALL not be blocked by them

#### Scenario: Active-domain object has no resource
- **WHEN** a Canonical Object is in the sealed active-domain selection but is not referenced by an ACT resource or prior core-node record
- **THEN** it SHALL remain in the containment, prerequisite, and association disposition denominator
- **AND** resource absence SHALL NOT close or remove its relation work

#### Scenario: Non-empty scope has complete containment
- **WHEN** every member of the exact non-empty scope has one admitted containment parent or explicit `COURSE_ROOT` disposition
- **THEN** the relation-bearing projection MAY proceed as `PARTIAL` if every other gate passes

#### Scenario: Non-empty scope has a containment gap
- **WHEN** any member lacks both an admitted containment parent and explicit course-root disposition
- **THEN** the new relation projection SHALL fail closed without replacing the prior selected relation projection

### Requirement: Consumer activation records independent combinations
The activation manifest MUST map each consumer to an explicit Authority release and, when required, Projection ID plus course active-domain scope hash. Consumers MAY pin different valid combinations, and Engineering-only consumers MAY omit a Projection. A relation-bearing teaching consumer MUST NOT select an empty or mismatched projection for a non-empty active-domain scope.

#### Scenario: Engineering consumer activates first
- **WHEN** an Authority snapshot is valid and no Teaching Projection exists
- **THEN** the Engineering Graph/RAG combination MAY become ready
- **AND** teaching consumers SHALL remain `NOT_PROJECTED` or pinned to their prior exact matching combination

#### Scenario: Empty projection is built
- **WHEN** ACT has a sealed empty or Engineering-only scope with no selected teaching-relation members
- **THEN** an empty Projection SHALL be legal and receive a deterministic manifest/hash
- **AND** it SHALL NOT satisfy a non-empty course active-domain selection

#### Scenario: Partial projection is selected
- **WHEN** a `PARTIAL` projection has complete containment, exact Authority and scope identity, and all other gates pass
- **THEN** the teaching consumer MAY select its admitted relations
- **AND** the runtime SHALL not represent prerequisite or association coverage as complete

### Requirement: Teaching Projection composes independently versioned domain fragments
The Teaching Projection builder MUST accept immutable reviewed domain fragments and MUST produce one deterministic composed manifest over their ordered identities and digests. Adding, removing or replacing a fragment MUST create a new projection version and MUST NOT mutate a previously published fragment. For every non-empty domain included in the sealed active-domain scope, composition MUST verify that each member has an admitted containment parent or explicit course-root disposition; an empty-relation fragment MUST NOT bypass that gate.

#### Scenario: Identical fragment set is composed twice
- **WHEN** the same ordered fragments, Authority identity, scope hash, governance inputs and builder version are composed twice
- **THEN** the composed manifest and projection hash SHALL be byte-identical

#### Scenario: One domain remains empty
- **WHEN** a valid fragment declares an empty member denominator for a domain
- **THEN** composition MAY publish with explicit empty scope
- **AND** the empty domain SHALL NOT make unrelated fragments review-required

#### Scenario: Non-empty domain lacks containment closure
- **WHEN** a fragment has one or more active-domain members and any member lacks both an admitted containment parent and course-root disposition
- **THEN** composition SHALL reject the new projection
- **AND** it SHALL not convert the fragment to empty coverage or infer structure from Engineering relations


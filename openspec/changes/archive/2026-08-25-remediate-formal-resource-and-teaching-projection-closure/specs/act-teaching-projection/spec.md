## ADDED Requirements

### Requirement: Remediation projection completeness is derived from reopened artifacts
The remediation Teaching Projection builder SHALL consume reopened files for the exact Authority capture, active-domain membership, three-family candidates/decisions/final ledgers, formal resource envelope, locale qualification, and shared coordination allocation required by the downstream cutover. It SHALL compute projection status and hashes from their semantic contents. Caller-provided hashes, paths without reopening, writable `COMPLETE` fields, or artifacts bound to a second allocation SHALL NOT establish a complete projection.

#### Scenario: Complete projection is materialized
- **WHEN** the exact Authority, resource envelope, locale state, and three-family closure receipt all reopen and validate under the same shared coordination allocation
- **THEN** the builder SHALL materialize the Teaching Projection and derive `COMPLETE` from those inputs
- **AND** its identity SHALL bind every semantic input hash and validator version

#### Scenario: Input hash is supplied without matching artifact
- **WHEN** a caller supplies a plausible projection, resource-envelope, ledger, or closure hash that cannot be recomputed from the declared immutable artifact
- **THEN** projection construction SHALL fail
- **AND** no handoff manifest SHALL record that hash as completed work

### Requirement: The complete remediation projection binds real formal resources without requiring node coverage
The complete remediation Teaching Projection SHALL bind the exact formal resource envelope and SHALL expose only reopened included resource bindings and governed launch descriptors. It SHALL preserve Canonical nodes with no resource and SHALL omit excluded or provisional resources from formal markers and launches without hiding their denominator dispositions from governance evidence.

#### Scenario: Included resources project into nodes
- **WHEN** an included resource has valid atoms, Canonical roles, access policy, and launch anchors under the matching envelope
- **THEN** the projection SHALL materialize its exact node bindings and resource descriptors
- **AND** multiple valid resource subtypes MAY coexist on the same node

#### Scenario: Node has no included resource
- **WHEN** a projected Canonical node has no included resource binding
- **THEN** the node SHALL remain valid and visible according to the Authority and product scope
- **AND** no unavailable placeholder resource or false marker SHALL be generated

#### Scenario: Resource is excluded
- **WHEN** a new-delta resource or explicitly retired baseline resource has a valid `EXCLUDED` disposition
- **THEN** it SHALL be absent from formal node markers, launch descriptors, and the formal resource projection
- **AND** its structured disposition SHALL remain present in the sealed governance package

#### Scenario: Active-baseline resource fails technically
- **WHEN** a non-retired production-active baseline teaching resource lacks a valid atom, binding, or launch contract
- **THEN** the complete remediation Teaching Projection SHALL NOT be materialized
- **AND** the resource SHALL NOT be converted into an exclusion to satisfy projection completeness

### Requirement: All declared Teaching Projection derivatives are materialized and coherent
The remediation run SHALL materialize independently versioned domain fragments, prerequisite publication, domain shards or overlays, and declared consumer projections from the same complete Teaching Projection. Every derivative SHALL bind the exact projection, Authority, resource envelope, shared coordination allocation, and semantic hash, and an independent validator SHALL prove membership, relation, resource, and hash coherence.

#### Scenario: Complete derivative set validates
- **WHEN** every declared fragment, shard, prerequisite artifact, and consumer projection reopens under the same complete projection
- **THEN** the system SHALL seal their exact identities in the non-selectable remediation handoff
- **AND** aggregate counts and semantic hashes SHALL be recomputed from the materialized artifacts

#### Scenario: Derivative is partial or belongs to another projection
- **WHEN** any required derivative is missing, partial, stale, or bound to another Authority, envelope, allocation, or projection
- **THEN** the remediation handoff SHALL fail validation
- **AND** downstream coordinated selection SHALL remain blocked

### Requirement: Remediation output remains separate from production activation
The completed Teaching Projection and its derivatives SHALL be marked qualified and non-selectable. The remediation workflow SHALL verify that production Authority, Teaching Projection, Runtime Release, domain-shard, and consumer selectors remain on their predecessor identities.

#### Scenario: Non-selectable projection is handed off
- **WHEN** the complete projection, resource envelope, relation closure, and derivatives pass independent validation
- **THEN** the workflow SHALL emit an immutable handoff manifest for downstream coordinated cutover
- **AND** it SHALL NOT deploy, activate, or modify a production selector

#### Scenario: Production selector mutation is observed
- **WHEN** any production selector changes during projection generation or validation
- **THEN** the remediation SHALL fail closed
- **AND** the output SHALL not be eligible for downstream coordination

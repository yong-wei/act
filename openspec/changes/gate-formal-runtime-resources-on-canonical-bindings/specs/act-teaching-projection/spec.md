## MODIFIED Requirements

### Requirement: Resource bindings use stable roles and identities
Every formal resource binding MUST use a deterministic resource ID, stable atom ID, exact registered runtime subtype, Canonical ID, one of `COVERS`, `EXPLAINS`, `PRACTICES`, or `ASSESSES`, and an explicit teaching scope. Binding identity MUST be derived from `resourceId + atomId + canonicalId + role + scopeId` and MUST bind the source/content identity and formal Runtime Release envelope. Resource subtype and teaching role SHALL remain orthogonal; adding video, audio, podcast, card, textbook, handout/slides, exercise, simulation, project, or another registered runtime subtype MUST NOT add or change a teaching role. Bindings MUST NOT mutate ActKG objects or predicates.

#### Scenario: Lesson step atom is projected
- **WHEN** a step authoring record names a stable atom, valid Canonical ID, exact subtype, and `PRACTICES`
- **THEN** the runtime binding SHALL preserve the exact role, subtype, atom, scope, source/content identity, release envelope, and Canonical identity

#### Scenario: Media paragraph is projected
- **WHEN** a qualified video, audio, or podcast semantic paragraph explains a valid Canonical Object
- **THEN** the binding SHALL use `EXPLAINS`, retain the exact media subtype and paragraph anchor, and receive deterministic atomic identity
- **AND** it SHALL not introduce a media-action role such as `WATCHES` or `LISTENS`

#### Scenario: Unsupported role or subtype is supplied
- **WHEN** authoring uses an unknown role, unregistered resource subtype, malformed resource ID, or malformed atom ID
- **THEN** projection build SHALL fail closed without replacing the prior release

### Requirement: Projection modes define local gate scope
Every candidate resource MUST declare its course delivery mode and formal inclusion disposition. `REQUIRED` or `OPTIONAL` MAY describe course delivery, but neither mode exempts an included teaching resource from atomic binding completeness. Legacy `NONE` MUST NOT admit an unbound teaching resource; it SHALL migrate to evidence-bearing atom-level `NON_TEACHING` dispositions or a resource-level `EXCLUDED` disposition. Development runtime MAY retain excluded or unresolved resources, but formal projection files SHALL contain only included, atomically closed resources.

#### Scenario: Required resource is unbound
- **WHEN** a `REQUIRED` resource has an unresolved atom or no valid bound atom
- **THEN** that resource SHALL be excluded from the formal projection with bounded reasons
- **AND** unrelated eligible resources MAY continue

#### Scenario: Optional resource is unbound
- **WHEN** an `OPTIONAL` teaching resource lacks atomic closure
- **THEN** it SHALL not publish merely because delivery is optional
- **AND** it SHALL remain in development runtime or the formal excluded ledger

#### Scenario: Legacy none is migrated
- **WHEN** a legacy `NONE` resource is considered for a new formal release
- **THEN** every atom SHALL receive a valid binding or audited non-teaching disposition, or the resource SHALL be excluded
- **AND** legacy `NONE` alone SHALL not satisfy the gate

## ADDED Requirements

### Requirement: Formal resource projection binds one Runtime Release envelope
Every formal resource manifest and binding file SHALL bind the exact Runtime Release v2 candidate, included, excluded, binding-set, Authority, course-scope, source, and pipeline-qualification identities. A Canonical Object MAY have zero resource bindings. The projection builder and consumer MUST reject any mixed or drifting envelope before exposing a resource marker, launch, RAG record, recommendation input, path input, or evidence input.

#### Scenario: Formal envelope is coherent
- **WHEN** all resource, atom, binding, Authority, scope, qualification, and release hashes resolve to the same candidate envelope
- **THEN** the formal resource projection MAY be sealed and consumed after the existing release gates pass

#### Scenario: Binding set belongs to another release
- **WHEN** a binding file or candidate ledger hash differs from the Runtime Release v2 receipt
- **THEN** the formal resource projection SHALL fail closed
- **AND** the prior active release and unrelated semantic node detail SHALL remain usable

#### Scenario: Canonical node has no formal resource
- **WHEN** a valid in-scope Canonical Object has no binding in the selected formal resource projection
- **THEN** the node SHALL remain valid without a resource marker or drawer launch
- **AND** the projection SHALL not fabricate a resource or report node failure

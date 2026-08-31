# resource-identity-and-generated-registry-index Specification

## Purpose

Define one deterministic, source-bound governance identity and generated resource index while preserving the independent owners of rendering, database resources, runtime content, Authority objects, planning nodes, and formal bindings.
## Requirements
### Requirement: Resource identity is explicit and source-bound

The resource-governance index SHALL identify an entry by a deterministic identity containing `sourceKind`, `sourceRef`, `sourceVersion`, `contentHash`, and `scope`, together with a versioned launcher-contract identity. It SHALL retain source-owned foreign references without treating them as aliases.

#### Scenario: A resource is indexed

- **WHEN** a declared source adapter supplies a resource and its source/version/hash/scope closure
- **THEN** the index SHALL emit one `ResourceIdentity` and one `ResourceDescriptor`
- **AND** the descriptor SHALL preserve any distinct `registryId`, Prisma `TeachingResource.id`, runtime lesson/media identity, Canonical ID, ResourceNode ID, and formal binding ID as typed references
- **AND** no missing identity SHALL be guessed from a title, route, filename, or display label.

#### Scenario: Two source records look alike

- **WHEN** records share a label or one source id resembles another source id
- **THEN** the builder SHALL keep their source kinds and references distinct
- **AND** it SHALL reject an ambiguous collision rather than merge identities.

### Requirement: Source adapters and the generated index have one owner

The system SHALL build `RegistryIndex` only from declared source-owned registries or immutable published artifacts. The index SHALL include its contract/version, source capture identities, ordered entries, launcher-contract identities, and digest, and SHALL be read-only with respect to its inputs.

#### Scenario: Inputs are unchanged

- **WHEN** the builder runs twice with the same source revision, artifact identities, adapter versions, and inputs
- **THEN** it SHALL produce byte-identical canonical output and the same index identity.

#### Scenario: Input closure drifts

- **WHEN** source revision, source reference, content hash, version, scope, launcher contract, or artifact identity differs
- **THEN** the builder SHALL produce a new index identity or fail closed
- **AND** it SHALL NOT reuse the prior index as current.

#### Scenario: An adapter is unowned or incomplete

- **WHEN** an adapter has no owner, omits its capture identity, emits duplicate identities, or invents a target
- **THEN** index qualification SHALL fail
- **AND** no guessed descriptor or private fallback registry SHALL be emitted.

### Requirement: Existing resource owners remain separate

The generated index SHALL NOT reclassify `src/lib/resource-registry.tsx`, the manifest plugin registry, the DB `TeachingResource` registry, the ResourceNode registry, the lesson-engine renderers, Authority/Canonical records, or formal binding records as one registry owner.

#### Scenario: A render resource is consumed

- **WHEN** a lesson-engine or feature consumer resolves a renderable resource
- **THEN** rendering SHALL remain owned by `resource-registry.tsx` and the existing renderer contract
- **AND** the generated index SHALL provide only the typed descriptor and source references needed by that consumer.

#### Scenario: A planning or formal record is referenced

- **WHEN** an index entry carries a ResourceNode, Canonical, or formal binding reference
- **THEN** the corresponding planning, Authority, or Teaching Projection contract SHALL remain authoritative for its own lifecycle and eligibility
- **AND** index membership SHALL not grant path eligibility, formal binding, or activation.

### Requirement: Launch descriptors are safe and source-owned

Every available `ResourceDescriptor` SHALL expose an existing source-owned launcher descriptor with role/scope and contract-version information. It MUST NOT expose a component path, filesystem path, signed URL, hidden evaluation payload, raw source body, or route constructed from a Canonical or ResourceNode identity.

#### Scenario: A caller requests a descriptor

- **WHEN** the server resolves a descriptor for a role and scope
- **THEN** it SHALL apply the existing authorization and revision checks before returning the launcher descriptor
- **AND** the caller SHALL pass that descriptor to the existing source-owned launcher.

#### Scenario: The launch contract is absent or stale

- **WHEN** no verified launcher exists or its contract/version does not match the index
- **THEN** the entry SHALL be `unavailable` or excluded according to its requiredness
- **AND** the system SHALL not construct a fallback route.

### Requirement: Optional resources degrade locally

An optional resource or derived output MAY be `degraded` or `unavailable` with a bounded code and safe status. Such a state SHALL affect only that entry or affected optional block and SHALL NOT bypass formal gates or make unrelated knowledge nodes unavailable.

#### Scenario: An optional card or media output is missing

- **WHEN** the base Authority/resource identity is valid but an optional card, media, or launcher output is absent
- **THEN** the index and consuming knowledge surface SHALL expose the bounded unavailable state or omit only that block
- **AND** valid base topology and detail SHALL remain readable.

#### Scenario: A required source identity is missing

- **WHEN** a required structural identity, hash, scope, or capture field is absent or invalid
- **THEN** the affected entry SHALL fail closed
- **AND** the builder SHALL not use `OPTIONAL`, `NONE`, a prior shadow binding, or successful-output discovery to bypass the failure.

### Requirement: Index qualification has a closed caller denominator

The implementation SHALL inventory all production, test, generated, compatibility, route/API, model, script, and reverse callers of the source registries and generated index. Each indexed entry and caller SHALL have one owner, one source/status classification, and an auditable migration or deletion condition.

#### Scenario: A duplicate table is replaced

- **WHEN** every classified caller resolves through the generated public index and descriptor parity is verified
- **THEN** the duplicate table MAY be deleted with a recorded zero-caller and rollback receipt
- **AND** source render owners, historical artifacts, activation readers, and unrelated registries SHALL remain.


## ADDED Requirements

### Requirement: Bundle v2 admission is pinned to reviewed compound identities

The v2 compatibility layer MUST accept only the reviewed
`control-theory-engineering-v0.18` publication whose tag target, source revision,
Manifest hash, `SHA256SUMS` hash, Bundle identity and digest, Release identity,
Schema `0.3.0` identity and raw hash, component closure, and required Artifact
contracts match the registered values exactly.

#### Scenario: Exact v0.18 publication reaches semantic validation

- **WHEN** every registered Git, Bundle, Release, Schema, checksum, component,
  and Artifact identity matches the pinned v0.18 package
- **THEN** the adapter SHALL continue to full v2 semantic and closure validation

#### Scenario: A version string matches but a compound identity drifts

- **WHEN** the package declares the expected version but any registered tag,
  commit, raw hash, digest, component, profile, or Artifact identity differs
- **THEN** the adapter MUST reject the package and MUST NOT classify it as a compatible update

### Requirement: Bundle v2 semantic artifacts are validated as one closed package

The adapter MUST validate the complete Manifest-declared file set, Projection
v3 runtime membership, Projection Profile manifest, multilingual label index,
link metadata, crosswalk, components, privacy constraints, and endpoint closure.
It MUST recompute and require 7,061 Release nodes, 6,843 runtime Projection
nodes, 2,811 published/runtime relations, and 1,909 terminology assertions.

#### Scenario: Multilingual labels and profile agree with runtime membership

- **WHEN** every `zh-CN` label resolves to one runtime entity and its terminology
  assertion and the runtime profile agrees with the Projection identity and hash
- **THEN** the validated result SHALL preserve the typed profile and label records

#### Scenario: Required v2 semantics are missing or inconsistent

- **WHEN** a required profile, label index, component, projection member,
  relation endpoint, or declared count is missing or inconsistent
- **THEN** validation MUST fail before any import output is produced

### Requirement: Validated v2 output preserves protocol-specific structure

On success, the adapter SHALL emit a storage-independent v2 result containing
the trusted capture revision, all raw package artifacts, distinct Bundle,
Release, Schema, component and Projection identities, typed Projection Profiles,
typed multilingual labels, recomputed statistics, and compatibility evidence.

#### Scenario: A downstream importer receives v2 input

- **WHEN** the exact package passes all v2 validation gates
- **THEN** the importer SHALL receive an explicitly versioned v2 result and
  SHALL NOT reinterpret it as the v1 validated-bundle shape

### Requirement: A failed v2 route cannot fall back

Once a Manifest declares `actkg-public-bundle/2`, any parsing, integrity,
compatibility, schema, or semantic failure MUST be terminal for that package.

#### Scenario: A v2 package fails validation

- **WHEN** a declared Bundle v2 package fails any v2 gate
- **THEN** the router MUST return the bounded rejection and MUST NOT invoke the
  v1 or historical adapter

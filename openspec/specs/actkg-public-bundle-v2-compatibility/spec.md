# actkg-public-bundle-v2-compatibility Specification

## Purpose
TBD - created by archiving change admit-actkg-public-bundle-v2. Update Purpose after archive.
## Requirements
### Requirement: Bundle v2 admission is pinned to reviewed compound identities

The v2 compatibility layer MUST accept only the reviewed
`control-theory-engineering-v0.18` publication whose registered tag target,
source revision,
Manifest hash, `SHA256SUMS` hash, Bundle identity and digest, Release identity,
Schema `0.3.0` identity and raw hash, component closure, and required Artifact
contracts match the registered values exactly.

#### Scenario: Exact v0.18 publication reaches semantic validation

- **WHEN** every registered Git, Bundle, Release, Schema, checksum, component,
  and Artifact identity matches the pinned v0.18 package
- **THEN** the adapter SHALL continue to full v2 semantic and closure validation

The publication and source tag targets are checked only by the separate
admission gate over a controlled, identity-pinned upstream Git root. The offline
Bundle loader MUST NOT require that checkout; it validates the exact raw
Manifest and package contents and reads `source_revision` only from that
Manifest.

#### Scenario: A version string matches but a compound identity drifts

- **WHEN** the package declares the expected version but any registered tag,
  commit, raw hash, digest, component, profile, or Artifact identity differs
- **THEN** the adapter MUST reject the package and MUST NOT classify it as a compatible update

#### Scenario: Admission gate checks the frozen registry and upstream tags

- **WHEN** the admission gate resolves the registered publication and source
  tags in the pinned upstream repository
- **THEN** the gate SHALL verify the registry identity, repository identity,
  both tag names, and both resolved commits; a missing tag, wrong repository, or
  retargeted tag MUST fail closed, and its gate-only result (including any
  `status:'PASS'`) MUST NOT be accepted by the offline loader

#### Scenario: Offline loading does not rediscover a later tag retarget

- **WHEN** a Bundle has already passed offline validation and an upstream tag is
  subsequently retargeted
- **THEN** the loader SHALL remain independent of that later Git state; only a
  new admission check can reject the retarget, and the result MUST distinguish
  Manifest source revision from a registry-controlled admission binding

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
The result MUST expose `manifestSourceRevision` only from the Manifest and a
fresh frozen `registeredAdmissionBinding` only from the module-controlled
registry. The binding MUST contain `provenance:'registry'`,
`verificationScope:'admission-time'`, `verifiedDuringLoad:false`, frozen
repository identity, publication/source tag commits, and Bundle identity. The
loader MUST reject caller-supplied `admissionEvidence`, proof, or registry
fields, including JavaScript/as-any inputs. No binding field is a cryptographic
signature or a claim that this load executed Git.

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

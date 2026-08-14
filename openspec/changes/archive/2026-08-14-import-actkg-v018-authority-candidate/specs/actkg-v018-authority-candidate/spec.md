## ADDED Requirements

### Requirement: Candidate intake mirrors the immutable v0.18 publication

The intake workflow MUST copy the complete v0.18 package from the pinned
publication tag tree, bind every copied byte to its Git object and registered
v2 identity, and validate it through the v2 adapter before materialization. A
mutable ActKG checkout or undeclared file MUST NOT become an input.

#### Scenario: The upstream checkout is dirty but the tag is valid

- **WHEN** the pinned tag tree and registered package identities are available
  while unrelated upstream working-tree changes exist
- **THEN** intake SHALL read only the tag tree and SHALL produce the same mirror

#### Scenario: A mirrored byte differs from the declared publication

- **WHEN** any copied file, file set, mode, hash, or tag identity differs
- **THEN** intake MUST fail without publishing a candidate directory

### Requirement: Runtime Projection membership defines the visible candidate

The candidate snapshot MUST contain exactly the 6,843 nodes and 2,811 links in
the admitted v0.18 runtime Projection, while preserving all 7,061 Release nodes,
component records, profiles, labels, crosswalks, metadata, and validation
artifacts as separately hashed evidence.

#### Scenario: The full package passes admission

- **WHEN** the v2 adapter returns the pinned validated package
- **THEN** materialization SHALL create one content-addressed staged Authority
  snapshot with complete runtime endpoint closure and 1,909 preserved label rows

#### Scenario: Release membership is mistaken for runtime visibility

- **WHEN** an implementation attempts to expose all Release entries without the
  admitted runtime Projection membership
- **THEN** candidate validation MUST fail before the snapshot can be qualified

### Requirement: The migration audit compares v0.9 directly with v0.18

The workflow MUST compute object, type, relation, endpoint, and identity
dispositions from the complete current v0.9 snapshot and complete v0.18
candidate. The upstream v0.17 to v0.18 release diff MAY be retained as evidence
but MUST NOT replace this comparison.

#### Scenario: A change predates v0.17

- **WHEN** an object or relation differs between v0.9 and v0.18 but is absent
  from the v0.17 to v0.18 delta
- **THEN** it SHALL still appear in the ACT migration impact report

### Requirement: Candidate reconstruction is deterministic and idempotent

Two clean builds from the same mirrored package and importer revision MUST
produce identical candidate identities, bytes, counts, hashes, and impact
evidence. Re-import MUST NOT duplicate mutable rows or rewrite an immutable release.

#### Scenario: The same package is imported twice

- **WHEN** both runs use the same capture and admitted package
- **THEN** both SHALL resolve to the same snapshot and evidence hashes

### Requirement: Candidate import never activates knowledge consumers

The workflow MUST record before-and-after hashes for Authority, Teaching
Projection, prerequisite, Authority domain-shard, consumer-activation, and
production marker pointers and MUST leave each byte-for-byte unchanged.

#### Scenario: Candidate materialization succeeds

- **WHEN** all import and reproducibility gates pass
- **THEN** the snapshot SHALL remain staged and production SHALL continue to select v0.9

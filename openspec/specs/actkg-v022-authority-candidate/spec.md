# actkg-v022-authority-candidate Specification

## Purpose
ACT 将 pinned `control-theory-engineering-v0.22` 复合发布包络镜像、准入并导入为未激活 Authority 候选；生产选择器保持当前 v0.18 激活状态，直到后续资格与切换变更。
## Requirements
### Requirement: Candidate intake mirrors the immutable v0.22 composite release envelope

The intake workflow MUST copy the complete `control-theory-engineering-v0.22`
Aggregate and its Component Manifest from the pinned publication, MUST mirror
every manifest-locked component — Integration v0.20, the Chinese terminology
component v0.5, the Schema, the Projection Profile, the tag index, and all
other declared components — at exactly the manifest-locked version, and MUST
bind every copied byte to its Git object and registered v2 identity. The
composite release envelope SHALL be the only import unit; a mutable ActKG
checkout, an undeclared file, or a per-component "latest" resolution MUST NOT
become an input.

#### Scenario: The upstream checkout is dirty but the pinned publication is valid

- **WHEN** the pinned publication tree and registered envelope identities are
  available while unrelated upstream working-tree changes exist
- **THEN** intake SHALL read only the pinned publication tree and SHALL
  produce the same mirror

#### Scenario: A component resolves outside the manifest lock

- **WHEN** any component version differs from the Component Manifest lock or
  is resolved from a "latest" pointer instead of the manifest
- **THEN** intake MUST fail without publishing a candidate directory

#### Scenario: A mirrored byte differs from the declared publication

- **WHEN** any copied file, file set, mode, hash, manifest entry, or
  publication identity differs
- **THEN** intake MUST fail without publishing a candidate directory

### Requirement: Admission reuses the admitted v2 adapter with explicit v0.22 evidence

The workflow MUST verify that the v0.22 envelope declares protocol
`actkg-public-bundle/2` and Schema `0.3.0` with a schema hash equal to the
hash already admitted for v0.18, and MUST then validate the envelope through
the existing v2 adapter without designing a new schema adapter. Explicit
v0.22 registration, validation, and admission evidence MUST be produced under
the `(bundleContractVersion, bundleDigest)` identity, disjoint from the v0.18
and V1 receipts.

#### Scenario: The schema hash matches the admitted v0.18 hash

- **WHEN** the mirrored envelope declares `actkg-public-bundle/2`, Schema
  `0.3.0`, and the admitted v0.18 schema hash
- **THEN** admission SHALL reuse the existing v2 adapter unchanged and SHALL
  record new v0.22 registration, validation, and admission receipts

#### Scenario: The declared protocol or schema identity differs

- **WHEN** the envelope declares a different protocol, schema version, or
  schema hash than the admitted v0.18 identities
- **THEN** admission MUST fail closed without adapting inline and without
  materializing a candidate

### Requirement: Manifest-declared runtime Projection membership defines the visible candidate

The candidate snapshot MUST contain exactly the nodes and links selected by
the runtime Projection Profile declared in the v0.22 Component Manifest, with
complete endpoint closure, while preserving all Release entries, component
records, profiles, label rows, crosswalks, metadata, and validation artifacts
as separately hashed evidence. Membership counts MUST NOT be hard-coded; the
workflow SHALL resolve them at intake, record them in the intake receipt, and
treat the recorded values as pinned evidence thereafter.

#### Scenario: The full envelope passes admission

- **WHEN** the v2 adapter returns the pinned validated envelope
- **THEN** materialization SHALL create one content-addressed staged Authority
  snapshot whose membership equals the manifest-declared runtime Projection
  and SHALL record the resolved object, relation, and label counts in the
  intake receipt

#### Scenario: Release membership is mistaken for runtime visibility

- **WHEN** an implementation attempts to expose all Release entries without
  the manifest-declared runtime Projection membership
- **THEN** candidate validation MUST fail before the snapshot can be qualified

### Requirement: The migration audit compares v0.18 directly with v0.22

The workflow MUST compute object, type, relation, endpoint, and identity
dispositions from the complete current v0.18 production snapshot and the
complete v0.22 candidate snapshot. Upstream intermediate release diffs
covering v0.19 through v0.22 MAY be retained as evidence but MUST NOT replace
this comparison.

#### Scenario: A change predates the latest upstream diff

- **WHEN** an object or relation differs between v0.18 and v0.22 but is absent
  from the retained upstream intermediate diffs
- **THEN** it SHALL still appear in the ACT migration impact report

### Requirement: Candidate reconstruction is deterministic and idempotent

Two clean builds from the same mirrored envelope and importer revision MUST
produce identical candidate identities, bytes, resolved membership counts,
hashes, and impact evidence. Re-import MUST NOT duplicate mutable rows or
rewrite an immutable release.

#### Scenario: The same envelope is imported twice

- **WHEN** both runs use the same capture and admitted envelope
- **THEN** both SHALL resolve to the same snapshot identity and evidence
  hashes, including identical recorded membership counts

### Requirement: Candidate import never activates knowledge consumers

The workflow MUST record before-and-after hashes for the Authority, Teaching
Projection, prerequisite, Chinese-display, Authority domain catalog/shard,
consumer-activation, and production marker selectors and MUST leave each
byte-for-byte identical to its current v0.18 value.

#### Scenario: Candidate materialization succeeds

- **WHEN** all import and reproducibility gates pass
- **THEN** the snapshot SHALL remain staged and production SHALL continue to
  select the v0.18 composite state


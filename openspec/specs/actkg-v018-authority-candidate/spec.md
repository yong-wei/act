# actkg-v018-authority-candidate Specification

## Purpose
TBD - created by archiving change import-actkg-v018-authority-candidate. Update Purpose after archive.
## Requirements
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

### Requirement: Candidate evidence uses a two-commit source and derived contract

The candidate-only evidence runner MUST distinguish a stable source
`captureRevision` E from the `generationRevision` F being verified. F MUST be the
current HEAD. E == F is valid; E may be an ancestor of F only when every changed
path in E..F is below an explicitly declared derived-output path. A non-ancestor,
an ordinary non-output change, or a generation revision that is not current HEAD
MUST fail closed.

The runner MUST resolve the complete source path membership from declared roots
only, then compare path set, Git object type, blob bytes, and Git mode across E,
F, and the working tree. Source and derived roots MUST be disjoint. Missing,
extra, symlink, mode, or content drift MUST fail closed. The candidate receipt
MUST be treated as a derived output and record both revisions, the source
contract version, source manifest digest, the complete `sourceEntries` set from
the declared roots (including the controlled Bundle root), and every derived
output's path, mode, byte length, and digest. The receipt digest MAY use a
documented canonical body-excluding-outputs scope to avoid self-reference; a
final commit SHA MUST NOT be invented. During generation, the receipt's
generation revision is the stable generator revision (equal to E); the
derived-only verification of F is a
separate read-only closeout.

Before generation, the runner MUST require the declared candidate output root
to be absent. Generation preflight MAY tolerate missing or replaced derived
entries that were present in E because those files are rebuilt; it MUST still
enforce the source, ancestor, overlap, and working-tree boundaries above. The
read-only `--verify-derived` path MUST disable that allowance and reject any
missing committed output or receipt manifest.

#### Scenario: The final evidence commit contains only derived outputs

- **WHEN** E is an ancestor of current HEAD F and all E..F paths are under the
  declared candidate output root
- **THEN** the runner SHALL accept the capture and bind the receipt to E and F

#### Scenario: A source or ordinary path changes after capture

- **WHEN** E..F changes a source, code, manifest, schema, config, lock, or any
  undeclared path
- **THEN** the runner MUST reject the evidence even if the derived outputs are
  otherwise valid

#### Scenario: Source bytes or modes drift in the working tree

- **WHEN** a declared source is missing, extra, symlinked, mode-changed, or its
  bytes differ from E/F
- **THEN** the runner MUST fail closed before publishing candidate evidence

#### Scenario: An ignored extra controlled Bundle member appears after F

- **WHEN** an additional file is placed below the declared controlled Bundle
  root and hidden with `.git/info/exclude`
- **THEN** the explicit source walk used by `--verify-derived` MUST reject the
  evidence even though Git status reports no untracked path

#### Scenario: Generation rebuilds a previously tracked derived tree

- **WHEN** E still contains prior derived files but the declared output root is
  absent from the worktree before generation
- **THEN** generation preflight SHALL validate the source closure without
  requiring those stale derived files, while `--verify-derived` SHALL reject
  the same missing output tree

### Requirement: Candidate import never activates knowledge consumers

The workflow MUST record before-and-after hashes for Authority, Teaching
Projection, prerequisite, Authority domain-shard, consumer-activation, and
production marker pointers and MUST leave each byte-for-byte unchanged.

#### Scenario: Candidate materialization succeeds

- **WHEN** all import and reproducibility gates pass
- **THEN** the snapshot SHALL remain staged and production SHALL continue to select v0.9

# actkg-v018-cutover-qualification Specification

## Purpose
TBD - created by archiving change qualify-actkg-v018-cutover-candidate. Update Purpose after archive.
## Requirements
### Requirement: Qualification binds one complete candidate release set

The qualification manifest MUST pin one clean application capture, the exact
v0.18 Bundle and Authority snapshot, localized-label artifact, Teaching
Projection, prerequisite publication, composed Authority domain-shard set, six
named consumer records, and complete v0.9 rollback identities. Mixed, mutable,
or unsealed inputs MUST be rejected.

#### Scenario: Candidate components come from different captures

- **WHEN** any Authority, label, teaching, prerequisite, shard, consumer, or
  rollback identity is not bound to the declared manifest
- **THEN** qualification MUST stop before behavioral tests and report the drift

### Requirement: Qualification recomputes complete migration and closure evidence

The workflow MUST verify 7,061 Release nodes, 6,843 visible nodes, 2,811
relations, 1,909 admitted label rows, component and endpoint closure, and the
complete v0.9 to v0.18 object/relation/reference impact set.

#### Scenario: Upstream incremental diff omits an older change

- **WHEN** direct baseline-to-candidate comparison finds a difference not present
  in the supplied v0.17 to v0.18 diff
- **THEN** the qualification report SHALL retain and classify that difference

### Requirement: Qualification tests every affected consumer and presentation boundary

The workflow MUST run pinned graph root/domain/family/neighborhood/detail,
localized and fallback label, no-system-string, engineering RAG, Teaching RAG,
Konling, course runtime, prerequisite, learning-path, card, and infograph checks
for the candidate. Every check MUST retain the exact input identities and result.

#### Scenario: A label query succeeds but exposes an internal identifier

- **WHEN** learner-visible output contains an ID, hash, release string, or machine slug
- **THEN** the presentation gate MUST fail even if the underlying query returned data

#### Scenario: One named consumer resolves a mixed combination

- **WHEN** any consumer reads an Authority, Projection, or prerequisite identity
  different from the manifest
- **THEN** qualification MUST be BLOCKED

### Requirement: Qualification separates reference closure from enrichment coverage

Every captured existing ACT teaching reference MUST resolve or carry an explicit
reviewed disposition. Missing teaching relations for new v0.18 entities and
missing Chinese terminology beyond the admitted index MUST be reported as
coverage but MUST NOT independently block qualification.

#### Scenario: Existing references close and new nodes lack teaching relations

- **WHEN** all captured references resolve and the remaining uncovered items are
  new v0.18 nodes without current ACT references
- **THEN** the teaching gate SHALL pass and report the incremental coverage gap

### Requirement: Two rebuilds and an isolated rollback exercise must pass

Two clean candidate rebuilds MUST produce identical material identities and
evidence. An isolated control root MUST advance all five copied v0.9 selectors
to the candidate, verify the composed shard and all six consumers, and restore
byte-identical v0.9 selectors, while real current pointers remain unchanged.

#### Scenario: Rebuild or rollback differs

- **WHEN** any rebuilt byte, pointer, consumer result, or restored predecessor differs
- **THEN** the readiness report MUST be BLOCKED and MUST NOT authorize publication

### Requirement: READY authorizes runtime publication only

The immutable report SHALL be READY only after every required audit, query,
consumer, determinism, and rollback gate passes. READY MUST NOT alter a real
current pointer or authorize production cutover by itself.

#### Scenario: All qualification gates pass

- **WHEN** the sealed report is READY and current pointer hashes still equal the pre-run values
- **THEN** the candidate MAY proceed to the separate runtime publication change

### Requirement: Teaching dual-replay trees are byte-equivalent files

Qualification MUST compare teaching `replay-1` and `replay-2` as independent
directory trees. Missing or empty trees MUST block. Every relative path present
in one tree MUST exist in the other with identical bytes.

#### Scenario: Teaching replay trees are absent

- **WHEN** either teaching `replay-1` or `replay-2` is missing
- **THEN** qualification MUST remain BLOCKED with `teaching-dual-replay-trees-absent`

#### Scenario: Teaching replay trees match

- **WHEN** both trees exist and all shared relative paths are byte-identical
- **THEN** teaching dual-replay SHALL not add a blocker

### Requirement: Neighborhood labels must resolve before shard compose advances

Isolated shard compose MUST resolve classifier-safe zh-CN labels for every
expanded neighborhood object. Overlay-backed labels count as resolved. Unsafe
display names MUST continue to fail closed.

#### Scenario: The 25 reviewed overlay labels are present

- **WHEN** qualification runs against the admitted v0.18 snapshot and overlay
- **THEN** isolated shard compose MUST NOT block on those 25 objects' labels


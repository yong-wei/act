## Context

ACT production currently selects the v0.18 composite state. The latest stable
ActKG Aggregate is `control-theory-engineering-v0.22`; its Component Manifest
locks Integration v0.20, the Chinese terminology component v0.5, the Schema,
the Projection Profile, the tag index, and the remaining declared components.
v0.22 continues to publish protocol `actkg-public-bundle/2` with Schema `0.3.0`
and the same schema hash that ACT admitted for v0.18. v0.22 has no local mirror
yet, so object, relation, and label counts are unknown until intake; admission
must preserve the complete upstream envelope and materialize an inactive ACT
snapshot whose membership is defined by the manifest-declared runtime
Projection, not by literal counts.

## Goals / Non-Goals

**Goals:**

- Mirror the exact pinned v0.22 composite release envelope — Aggregate plus
  Component Manifest and every locked component — into an immutable ACT release
  directory.
- Import the manifest-declared v0.22 runtime Projection into a deterministic,
  content-addressed candidate snapshot with explicit registration, validation,
  and admission evidence.
- Produce a complete v0.18 to v0.22 impact report and reproducibility proof.

**Non-Goals:**

- Changing current production selectors, markers, or the Authority domain
  catalog; production continues to select the v0.18 composite state.
- Designing a new schema adapter; the admitted v2 adapter is reused.
- Creating ACT teaching relationships or selecting localized labels for display.
- Re-reviewing upstream engineering entities and relations.

## Decisions

### 1. The composite release envelope is the import unit

Intake resolves exactly one pinned Aggregate publication and reads its
Component Manifest as the only authority for component versions. Every locked
component — Integration v0.20, Chinese terminology v0.5, Schema, Projection
Profile, tag index, and the rest — is mirrored at the manifest-locked version.
A component resolved from "latest", from a different release, or from outside
the manifest fails intake. This implements the confirmed boundary that the
next cutover cannot mix v0.22 Authority with v0.9 or v0.18 components.

### 2. Mirror the full pinned publication, not a mutable checkout

The mirror copies only files from the pinned publication tree and records the
publication target, source revision, Git object IDs, file modes, raw hashes,
the Component Manifest, and the envelope digest. The working state of the
ActKG repository is not an input. This repeats the v0.18 mirror discipline
unchanged.

### 3. Reuse the admitted v2 adapter with explicit v0.22 evidence

Because v0.22 declares `actkg-public-bundle/2` and Schema `0.3.0` with the
same schema hash as the admitted v0.18, the existing V2 persistence adapter is
reused as-is; no new adapter, importer branch, or schema migration is designed.
The reuse is gated, not assumed: intake first verifies that the declared
protocol, schema version, and schema hash equal the admitted v0.18 identities
and fails closed on any difference instead of adapting inline. Registration of
the v0.22 envelope, its validation receipt, and its admission binding are new
evidence records in the existing V2 identity namespace; the receipt natural
key `(bundleContractVersion, bundleDigest)` keeps v0.22 idempotency disjoint
from v0.18 and from V1.

### 4. The manifest-declared runtime Projection defines visible membership

The candidate's visible snapshot contains exactly the nodes and links selected
by the runtime Projection Profile that the Component Manifest declares, with
complete endpoint closure. Release entries outside that membership, component
records, profiles, label rows, crosswalks, metadata, and validation reports
are preserved as separately hashed evidence. Because no local v0.22 mirror
exists yet, no count is hard-coded anywhere: the resolved membership counts
are computed at intake, recorded in the intake receipt, and thereafter treated
as pinned evidence that both rebuilds must reproduce exactly.

### 5. Build the impact report from complete baseline and candidate snapshots

The impact report compares the current v0.18 production snapshot and the
candidate v0.22 snapshot directly: identities, objects, relations, types, and
endpoint closure. Upstream intermediate release diffs (v0.19 through v0.22)
are retained and verified as evidence but cannot replace the computed v0.18 to
v0.22 comparison.

### 6. Make staging idempotent and non-activating

Candidate identity derives from normalized validated content. Re-import of the
same envelope returns the same snapshot identity and does not duplicate rows
or rewrite immutable files. Any database-backed proof uses a disposable local
schema and leaves shared schemas and all current selectors unchanged. The
selector closure asserted before and after intake is: Authority, Teaching
Projection, prerequisite, Chinese-display, Authority domain catalog/shard,
consumer-activation, and production marker — each byte-identical to its
current v0.18 value.

### 7. Prove deterministic reconstruction twice under the v0.18 capture contract

Two clean materializations from the mirrored envelope must produce identical
snapshot bytes, hashes, resolved membership counts, label-index identity, and
impact report. The runner reuses the capture closure and two-commit
source/derived contract established by the v0.18 candidate change: the capture
binds the complete `prisma/migrations/` tree, Prisma config/client seams, the
disposable-database helper, the V2 loader/admission schemas/importer, the
impact calculator, the v0.18 baseline audit inputs, and the adjacent mirror
receipt; exact Git-file checks reject changed, deleted, added, ignored, mode-
drifted, or untracked members of that closure before replay and again before
publication, and late drift removes the partial output root without leaving a
candidate receipt. Only the release identifiers, capture roots, and baseline
inputs change from v0.18 to v0.22; the contract itself is not widened.

## Risks / Trade-offs

- The complete envelope and snapshot are larger than an incremental patch, but
  they are independently auditable and suitable for rollback.
- Membership counts are unknown until intake; expressing requirements against
  the manifest-declared Projection trades literal review anchors for intake-
  time evidence. The recorded counts in the intake receipt restore a concrete
  anchor for the qualification and cutover changes that follow in the series.
- Existing card and infographic assets may not cover every new node; coverage
  is reported separately and does not alter Authority identity.

## Migration Plan

1. Add the pinned v0.22 envelope mirror and lock record, including the
   Component Manifest and every locked component.
2. Verify protocol/schema identity against the admitted v0.18 hash, then
   validate the envelope through the reused v2 adapter and record v0.22
   registration, validation, and admission receipts.
3. Materialize the candidate and the v0.18 to v0.22 impact evidence twice.
4. Publish only immutable candidate artifacts; assert all current selectors
   remain byte-identical v0.18 values.

## Open Questions

- None. Zh-CN display projection, qualification, domain catalog rebuild, and
  activation belong to later changes in series issue #1441.

## Context

ACT currently selects the v0.9 Authority snapshot. v0.18 contains 7,061
released knowledge nodes; its runtime Projection exposes 6,843 nodes and 2,811
relations and carries 1,909 `zh-CN` terminology rows. Admission must preserve
the complete upstream package and materialize an inactive ACT snapshot without
using the v0.17 to v0.18 diff as a migration substitute.

## Goals / Non-Goals

**Goals:**

- Mirror the exact upstream publication bytes into an immutable ACT release directory.
- Import the full v0.18 runtime projection into a deterministic candidate snapshot.
- Produce a complete v0.9 to v0.18 impact report and reproducibility proof.

**Non-Goals:**

- Changing current pointers or production markers.
- Creating ACT teaching relationships or selecting localized labels for display.
- Re-reviewing upstream engineering entities and relations.

## Decisions

### 1. Mirror the full tag tree, not a mutable checkout

The mirror copies only files from the pinned publication tag tree and records
the tag target, source revision, Git object IDs, raw hashes, and Bundle digest.
The working state of the ActKG repository is not an input.

### 2. Treat the runtime Projection as the visible Authority membership

The 7,061 Release entries remain part of the preserved package, while the
6,843 runtime Projection nodes and 2,811 links define the candidate visible
snapshot. Projection profiles, label rows, components, crosswalks, link
metadata, and validation reports remain separately hashed evidence.

### 3. Build from complete baseline and candidate snapshots

The impact report compares current v0.9 and candidate v0.18 identities,
objects, relations, types, and endpoint closure directly. Upstream
`release-diff.json` is retained and verified, but cannot replace the computed
v0.9 to v0.18 comparison.

### 4. Make staging idempotent and non-activating

Candidate identity derives from normalized validated content. Re-import of the
same package returns the same snapshot identity and does not duplicate rows or
rewrite immutable files. Any database-backed proof uses a disposable local
schema and leaves shared schemas and all current pointers unchanged.

### 5. Prove deterministic reconstruction twice

Two clean materializations from the mirrored package must produce identical
snapshot bytes, hashes, counts, label-index identity, and impact report. A
mixed revision or untracked source is rejected before output publication.

## Risks / Trade-offs

- The complete package and snapshot are larger than an incremental patch, but
  they are independently auditable and suitable for rollback.
- Existing card assets may not cover every new node; card coverage is reported
  separately and does not alter Authority identity.

## Migration Plan

1. Add the pinned release mirror and lock record.
2. Validate it through the v2 adapter.
3. Materialize the candidate and v0.9 to v0.18 impact evidence twice.
4. Publish only immutable candidate artifacts; assert all current pointers are unchanged.

## Open Questions

- None. Teaching and presentation readiness belong to later changes.

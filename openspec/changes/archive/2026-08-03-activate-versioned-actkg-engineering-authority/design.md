## Context

The upstream ActKG v0.12 package has passed publication checks and contains 5,820 projection nodes and 2,837 engineering relations. ACT must verify package identity and materialize a read-only runtime snapshot, not decide whether upstream engineering objects or predicates are meaningful for a course.

## Series Dependencies

- Depends on: `revise-actkg-authority-boundary`.

## Goals / Non-Goals

**Goals:**

- Deterministically transform one admitted Bundle/Release/ReleaseSet into one immutable Authority Snapshot.
- Atomically expose the current snapshot and retain the prior pointer for rollback.
- Keep engineering consumers independent from teaching projection readiness.
- Preserve existing adapter and Repository contracts, including candidate and legacy modes.

**Non-Goals:**

- No second database, schema, graph store, or duplicate release identity.
- No ACT semantic review of ActKG entities/relations and no CourseCoverage generation.
- No consumer-wide activation of teaching/path/KAQ/RAG combinations; later activation change owns that.

## Decisions

### 1. Snapshot identity and contents

The snapshot is a deterministic serialization of the validated Repository view and retains `contract`, `releaseId`, `releaseHash`, `bundleDigest`, `schemaVersion`, `predecessorReleaseId`, node/relation counts, source/provenance summary, and `snapshotHash`. Canonical IDs and exact predicates are preserved; no type flattening or association rewrite is allowed.

### 2. Staged import and atomic pointer

Import writes a fully validated snapshot under `authority/releases/<snapshotId>/` and a manifest under the same directory, but remains candidate/staged-only and does not change any selector. A separate explicit activation operation validates the immutable snapshot/manifest and only then replaces `authority/current.json` using a temporary file plus atomic rename. The pointer contains the snapshot ID and digest, never partial content; import and activation have separate receipts and failure boundaries.

### 3. ReleaseSet and Delta lineage

The snapshot records the accepted ReleaseSet, import receipt, and sequential Delta receipts used to build it. A semantic-empty packaging Delta is recorded but does not create teaching work. Upstream diff data is cross-checked only; Bundle/Repository state remains the authority.

### 4. Rollback

Before pointer replacement, the previous current pointer is copied to a versioned rollback record. Rollback validates that target snapshot and pointer digest still match, then atomically replaces only the pointer. Snapshot directories are immutable and retained.

### 5. Failure behavior

Any unsupported Bundle, hash/schema mismatch, missing endpoint, duplicate ID, malformed relation, non-deterministic serialization, or receipt/capture drift aborts before pointer replacement. Teaching projection and CourseCoverage are not consulted and cannot turn a valid engineering snapshot into a rejection.

Import failure leaves the prior Authority pointer untouched. Activation failure leaves both the prior Authority pointer and all teaching/Legacy selectors untouched; successful activation may advance only Engineering Graph/RAG and never implicitly starts a teaching migration.

## Risks / Trade-offs

- Disk usage grows with immutable snapshots; retention is an operational policy outside this change, and rollback artifacts remain available.
- Existing readers may require compatibility adaptation to read `current.json`; they must fail closed rather than silently mixing revisions.
- Upstream package acceptance remains dependent on exact Bundle contract support; unknown required artifacts still reject.

## Migration Plan

Stage the v0.12 release through the existing import path, build and verify its snapshot, then run engineering graph/RAG shadow queries. Activate only the engineering pointer; leave course and teaching selectors unchanged. A failed activation leaves the prior pointer untouched, and rollback is a pointer-only operation.

## Open Questions

None. Runtime directory names may follow existing release tooling, provided identity and atomicity invariants remain unchanged.

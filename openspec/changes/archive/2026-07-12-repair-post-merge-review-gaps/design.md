## Context

The independent repair branch is `repair-post-merge-review-gaps` at commit `f893734a8`, and its authoritative input is the diff from `origin/integration`. That diff touches the assignment publication service, submission asset domain/service/read route, portrait v2 materialization, and focused regression tests.

The existing contracts already require active class audiences, stable incremental portrait v2 state, and submission assets that retain checksum metadata. The repair therefore stays at the implementation boundary: it closes the three observed gaps without introducing a new database schema, migration, or parallel data model.

## Goals / Non-Goals

**Goals:**

- Make the administrator publication path use the same active-class boundary as the teacher path and fail before audience creation for inactive classes.
- Serialize each student's portrait snapshot read/update/write sequence inside one database transaction while retaining the existing cursor and evidence filtering behavior; fail closed if the transaction client cannot acquire the advisory lock.
- Make submission asset reads fail closed when either the stored byte count or stored SHA-256 digest differs from the fetched object.
- Preserve the current public error, authorization, idempotency, and incremental-update contracts outside these three repairs.

**Non-Goals:**

- Changing Buddy Auto, any Buddy skill, or any file in the external OpenSpec-buddy repository.
- Touching the `e734` worktree, `dev1`, or any other worktree.
- Re-running or re-performing the original PRs' local reviews.
- Adding migrations, changing object-store providers, redesigning portrait scoring, or expanding assignment publication behavior.
- Creating a new OpenSpec capability or modifying production code beyond the three already-scoped repairs.
- Reordering historical LearningFact ingestion by commit order; that requires a
  separate cursor/version migration and is not introduced by this repair.

## Decisions

### 1. Apply the active-class predicate to every publication actor

The administrator branch of `publishAssignmentRevision` will require `isActive: true` when resolving selected classes. The existing managed-id comparison remains the single authorization decision, so an inactive class produces the existing publication-blocked result before revision freezing or audience creation.

This is preferred over a separate administrator exception because it keeps the publication boundary uniform and prevents an elevated role from bypassing delivery lifecycle state. No API shape or persistence model changes.

### 2. Lock the complete portrait materialization unit of work

The materializer will run its existing read-facts, compute-delta, and write-snapshot sequence through the Prisma transaction client. A transaction-scoped PostgreSQL advisory lock derived from the student id is acquired before the previous snapshot is read. The lock is released automatically with the transaction, so concurrent runs for one student cannot observe and overwrite the same snapshot baseline.

The computation remains an inner operation that accepts the transaction-scoped database interface. The lightweight adapter path remains available for existing non-Prisma unit fixtures, while the production Prisma path uses the transaction and advisory lock. A transaction client that cannot provide the lock primitive fails before the snapshot read. The existing fact ordering, cursor boundary, context-only filtering, and seven-dimension update algorithm are unchanged. Explicit historical fact-ingestion ordering remains a separate follow-up concern.

### 3. Verify both size and digest at object-read time

The submission read service will return the persisted checksum with the authorized asset metadata. The route will hash the fetched bytes with SHA-256 and compare the result and byte length against the persisted values before constructing the response. A mismatch raises the domain-level `asset-integrity-mismatch` error with a 502 response, so same-size tampering is rejected rather than served.

This complements upload/finalization metadata checks: finalization protects what is recorded, while read-time verification protects what is returned. No raw bytes are logged or persisted by this repair.

### 4. Keep evidence narrowly focused

The current branch's focused tests are the evidence surface: inactive administrator publication, transaction/lock invocation for portrait materialization, and same-size asset tampering. Validation will inspect the proposal artifacts, three capability deltas, the Buddy issue-body contract, and the affected test files without changing test scope.

## Risks / Trade-offs

- PostgreSQL advisory locks are database-specific and hash-derived → keep the lock transaction-scoped, use the existing Prisma/PostgreSQL runtime, and avoid exposing the lock as an application-level state.
- Hashing every downloaded asset adds bounded CPU and latency → integrity is checked only after authorization and object retrieval, and the existing size limit bounds the maximum input.
- Inactive-class rejection may surface previously hidden stale publication attempts → this is the intended fail-closed behavior; the existing publication-blocked details identify the class.
- A failed integrity check returns an upstream-style 502 rather than partial bytes → callers receive no unverified object content and can retry or surface a recoverable asset error.
- The existing LearningFact cursor remains based on persisted `createdAt`; a
  separate migration is required before claiming commit-order guarantees for
  long-running historical backfills. This repair claims only same-learner
  materialization read/update/write serialization.

## Migration Plan

No data migration or deployment migration is required. The repair is a narrow code-path hardening change with regression evidence already present in the branch diff. Rollback, if required before release, is limited to reverting this independent repair commit; no persisted records need to be rewritten.

## Open Questions

None. The repair boundaries, base branch, and excluded worktrees/tools are fixed by the request and the observed diff.

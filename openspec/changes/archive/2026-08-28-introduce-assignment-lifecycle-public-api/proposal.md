# Proposal: Introduce the assignment lifecycle public API

## Why

`Assignment` already has a stable Prisma identity and an implemented draft,
publication, audience, submission, and attempt lifecycle, but callers still
discover that behavior through route-local queries, feature contracts, and
internal service functions.  A single public application boundary is needed
before review and legacy migration can move without creating another owner or
changing the student-facing lifecycle.

## What Changes

- Establish `src/lib/assignments` as the only business owner of assignment
  lifecycle behavior and expose a stable public API for DTOs, use cases,
  ports, adapters, and domain errors.
- Move teacher and student route callers to that API; routes retain only
  authentication, mutation protection, input parsing, and response mapping.
- Preserve the existing `Assignment`, `AssignmentRevision`,
  `AssignmentAudience`, `AssignmentQuestion`, `AssignmentSubmission`,
  `SubmissionAnswer`, and `SubmissionAttempt` identities and behavior.
- Preserve immutable published revisions, question/attempt snapshots,
  audience and frozen-student authorization, publication compare-and-swap,
  and idempotency semantics.
- Capture and close the owner/route/API/model/worker/script/test/caller
  denominator, including direct Prisma and deep-import callers, before and
  after the vertical migration.
- Add contract, authorization, concurrency, privacy, idempotency, rollback,
  and no-facade tests.  Run-specific QA output remains externalized; only a
  revision, hash, and conclusion receipt may be retained in this change.

## Capabilities

### New Capabilities

- `assignment-lifecycle-public-api`: Defines the public assignment lifecycle
  boundary and its ownership, DTO, application, persistence, and route rules.

### Modified Capabilities

None.  Existing assignment authoring, submission, publication, and review
contracts remain the behavioral source; this change makes their existing
owner and entry boundary explicit.

## Impact

- **Owner:** `src/lib/assignments/*` and the existing Prisma Assignment*
  models remain the sole Assignment business owner.  `assignment-authoring`
  and `assignments` are UI slices only.
- **Routes/API:** teacher assignment CRUD/publication/asset routes and student
  assignment, answer, asset, submit, history, and feedback routes become thin
  callers of the public API.
- **Models:** no new table, enum, migration, or replacement identity; the
  current revision, audience, question, submission, and attempt snapshots are
  retained.
- **Workers/scripts:** no new worker or publication pipeline is introduced;
  existing object-store, retention, and repair scripts are characterized and
  remain governed by their current owners.
- **Tests/callers:** the complete direct-import and route-caller inventory is
  a migration artifact and must be empty for forbidden production edges at
  the end of the change.
- **Dependencies:** blocked by `establish-modular-monolith-refactor-charter`
  and `enforce-modular-domain-dependency-contracts`.  Assignment review
  authority migration consumes this public boundary in the next change.

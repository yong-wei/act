## Context

The repository already separates four stages: candidate admission of an
authoritative engineering release, deterministic ACT Teaching Projection rebase,
consumer activation, and legacy runtime retirement. Those stages must remain
separate because the same release can be complete for engineering identity while
its teaching projection or consumer evidence remains incomplete.

This change is executed from the permanent `resource` worktree. It prepares
files only: no database import, selector update, active consumer pointer update,
remote-server operation, deployment, or legacy-retirement operation is in scope.
The existing 34-batch CourseCoverage audit and its 4,880 DEFER outcomes are
historical evidence. They are immutable inputs, not candidates in this release
delta denominator.

## Goals / Non-Goals

**Goals:**

- Freeze the clean worktree revision and the exact locally available ActKG
  Release before reading candidate inputs.
- Materialize content-addressed Authority and Teaching Projection candidates in
  a non-default preparation root, with a deterministic impact set and a
  separately traceable REVIEW_REQUIRED worklist.
- Record exact pre-existing pointer observations without following, replacing,
  or repairing those pointers.
- Prepare six named consumer manifests with readiness, shadow comparison, and
  rollback evidence that can be reviewed before a later switch request.
- Emit one readiness report that states both the executable-switch prerequisites
  and any remaining blockers using actual artifact evidence.

**Non-Goals:**

- Changing `current.json`, an active consumer selector, a database authority
  record, a deployed runtime, remote server, Docker image, or production
  configuration.
- Treating candidate import as activation, or treating shadow verification as a
  production cutover.
- Retiring legacy knowledge, mutating historical CourseCoverage evidence, or
  re-reviewing unbound ActKG entities semantically.

## Decisions

### 1. Use a per-run immutable preparation root

Each run writes only to
`artifacts/actkg-cutover-preparation/<capture-revision-or-run-id>/`. The root
contains a manifest that hashes every materialized input and derived document.
It is never named `current.json` and is outside Authority, Projection,
consumer-activation, and legacy-retirement default-pointer directories.

This makes review and rollback a matter of selecting an immutable directory,
not reconstructing a transient command invocation. Writing a default candidate
location was rejected because its name could be mistaken for activation and can
erase evidence from an earlier attempt.

### 2. Freeze identity before projection work

Phase 0 records the ACT capture revision, the resource worktree role and dirty
ownership, and byte-level observations of the existing relevant pointers. Phase
1 then validates the selected Release's declared schema, bundle identity,
digests, closure, and compatibility before copying or deriving any candidate
artifact.

The alternative—discovering inputs independently per consumer—was rejected:
it can create a plausible but mixed revision set and violates the existing
capture-revision invariants.

### 3. Treat engineering identity as verified input and teaching as the only
incremental review domain

Published ActKG engineering entities, formulae, system models, and engineering
relationships receive identity, schema, hash, and closure verification only.
The projection impact set is computed by matching the frozen baseline and
candidate release, then filtering to active ACT course resource bindings,
textbook locators, prerequisites, and teaching semantics. Split, merge, missing
successor, and semantic ambiguity produce stable REVIEW_REQUIRED records instead
of guessed successors.

Re-reviewing the whole upstream graph was rejected because it duplicates the
authority release process and makes the delta non-deterministic. Folding the
historical CourseCoverage DEFER population into the denominator was rejected
because it changes a completed audit rather than evaluating this release.

### 4. Model consumers as explicit staged contracts

Each of engineering-graph, engineering-rag, course-runtime, konling,
teaching-resource-rag, and learning-path receives one manifest that pins the
same Authority and Projection identities (or records why that consumer cannot
pin one), readiness result, shadow result, and rollback target. A consumer may
be `READY`, `PINNED`, `BLOCKED`, or `SHADOW`; it is not called activation-ready
solely because a candidate exists.

A shared aggregate status without per-consumer manifests was rejected because it
cannot show an atomic switch set or identify the specific missing evidence.

### 5. Exercise only non-default staged activation and rollback

Where existing tooling permits it, the run creates a disposable staged selector
inside its preparation root, validates a shadow read against it, then restores
the pre-exercise staged state. The run verifies that no default pointer bytes
changed before and after the exercise.

Directly exercising live selectors was rejected because the requested work is
preparation only. Skipping rollback evidence was rejected because a candidate
cannot support a later reversible switch without it.

## Risks / Trade-offs

- [No compatible locally available Release] → stop at Phase 1 with a signed
  absence/readiness record; do not synthesize a release or fetch from a remote
  host.
- [A local artifact lacks a trusted capture revision or digest] → mark the
  affected Authority, Projection, or consumer as `BLOCKED` and preserve the
  raw observation.
- [The deterministic delta needs a database-only input] → record the exact
  missing local evidence and stop rather than write a database record or infer
  impact from filenames.
- [A pointer changes while preparing] → fail the manifest comparison and leave
  the candidate unactivated; no pointer-repair action is permitted here.
- [A staged shadow read cannot execute locally] → retain its manifest as
  `BLOCKED`; no claim of runtime compatibility is made.

## Migration Plan

1. Validate and commit the OpenSpec plan, then capture Phase 0 observations.
2. Materialize and verify only candidate artifacts under the per-run root.
3. Generate deterministic projection, consumer, and readiness evidence.
4. Verify pointer non-mutation, artifact closure, and the relevant existing
   validators; commit the evidence package.
5. A later, separately authorized operation may use this package to request an
   atomic pointer switch only if every affected consumer has acceptable staged,
   readiness, shadow, and rollback evidence. Legacy retirement remains a later
   operation after that switch and a zero-fallback observation window.

Rollback for this preparation is deletion of no files: retained immutable runs
remain auditable and all live pointers must compare byte-for-byte with their
Phase 0 observations.

## Open Questions

- Which locally available Release is the newest one that still has a complete,
  compatible bundle and predecessor baseline at the captured revision?
- Can every named consumer perform its existing shadow/readiness check without
  a database or service dependency, or must a concrete local evidence gap remain
  `BLOCKED`?
- Does the active-course binding corpus expose all prerequisite and textbook
  locator successors required for a complete candidate projection?

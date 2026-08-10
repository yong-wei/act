## Why

ACT needs a reviewable, executable local cutover package. The release-admission,
teaching-projection, consumer-activation, and legacy-retirement contracts
already define their own boundaries, but none of them both derives the missing
ACT teaching semantics from current BOPPPS blueprints and performs one verified
local activation of the resulting release set.

## What Changes

- Record a clean resource-worktree baseline, captured Git revision, and the
  pre-existing Authority, Projection, consumer-activation, and legacy-retirement
  pointer state.
- Validate one explicitly selected locally available ActKG Release and materialize
  an immutable Authority candidate in a non-default staging root.
- Compute the ACT-owned delta and a deterministic, inactive Teaching Projection
  candidate. Keep the historical 34-batch CourseCoverage audit (4,880 DEFER)
  outside this release delta denominator.
- Use current interactive-course arrangements and BOPPPS blueprints as
  ACT-owned evidence to record formal, capture-bound author decisions for every
  unresolved active resource. Preserve deterministic mappings and explicit
  non-semantic resources rather than flattening them into guessed mappings.
- Produce per-consumer staging manifests, readiness, shadow, and rollback
  evidence for engineering-graph, engineering-rag, course-runtime, konling,
  teaching-resource-rag, and learning-path.
- Stage, shadow-verify, roll back, and atomically activate the complete local
  Authority/Projection/consumer release set once all consumers are READY.
- Produce a local readiness and activation report that identifies identities,
  pointer state, rollback evidence, and remaining post-switch work.

## Capabilities

### New Capabilities

- `actkg-to-act-cutover-preparation`: derive capture-bound ACT teaching decisions,
  stage immutable Authority and Teaching Projection releases, and atomically
  activate their single local consumer manifest without retiring legacy state.

### Modified Capabilities

- None. Existing release ingestion, projection rebase, consumer activation, and
  legacy retirement specifications remain their respective execution contracts.

## Impact

- New auditable preparation artifacts under an explicit non-default local
  staging root and a readiness report under this change.
- Existing local ActKG release artifacts, ACT knowledge artifacts, and existing
  preparation/validation scripts are read as inputs.
- The local repository's Authority, Teaching Projection, prerequisite, and
  consumer-activation pointers are advanced only through their existing atomic
  stores after a complete staged/shadow/rollback proof. No deployed service,
  Docker image, remote server, shared database `public` schema, or
  legacy-retirement pointer is changed. A disposable, task-specific local
  database schema may hold candidate-import records solely to verify the staged
  Authority Snapshot; it is never a default read path and is removed after
  verification.

## Why

ACT needs a reviewable local preparation package before a separately authorized
ActKG-to-ACT graph pointer switch. The release-admission, teaching-projection,
consumer-activation, and legacy-retirement contracts already define their own
boundaries, but none of them records one immutable pre-switch evidence set for
the exact source release, affected teaching projection, and all consumers.

## What Changes

- Record a clean resource-worktree baseline, captured Git revision, and the
  pre-existing Authority, Projection, consumer-activation, and legacy-retirement
  pointer state.
- Validate one explicitly selected locally available ActKG Release and materialize
  an immutable Authority candidate in a non-default staging root.
- Compute the ACT-owned delta and a deterministic, inactive Teaching Projection
  candidate. Keep the historical 34-batch CourseCoverage audit (4,880 DEFER)
  outside this release delta denominator.
- Produce an explicit REVIEW_REQUIRED worklist for affected course bindings,
  textbook locators, prerequisites, and teaching semantics when no deterministic
  successor can be established.
- Produce per-consumer staging manifests, readiness, shadow, and rollback
  evidence for engineering-graph, engineering-rag, course-runtime, konling,
  teaching-resource-rag, and learning-path.
- Produce a local readiness report that identifies the evidence required before
  a later, separately authorized atomic pointer switch.

## Capabilities

### New Capabilities

- `actkg-to-act-cutover-preparation`: prepare immutable, local-only Authority and
  Teaching Projection candidates plus consumer evidence without changing a
  production selector, active consumer pointer, or legacy-retirement state.

### Modified Capabilities

- None. Existing release ingestion, projection rebase, consumer activation, and
  legacy retirement specifications remain their respective execution contracts.

## Impact

- New auditable preparation artifacts under an explicit non-default local
  staging root and a readiness report under this change.
- Existing local ActKG release artifacts, ACT knowledge artifacts, and existing
  preparation/validation scripts are read as inputs.
- No runtime selector, default `current.json`, database authority record,
  deployed service, Docker image, remote server, or legacy-retirement pointer is
  changed by this proposal.

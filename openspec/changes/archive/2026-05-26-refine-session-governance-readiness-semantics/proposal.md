## Why

Classroom governance reports currently combine distinct states such as durable
submission coverage, scoreable evidence coverage, snapshot coverage, post-class
regeneration, and feature-cache freshness. A session can have current snapshots
for the latest facts while still being classified as partially missing because
the snapshot was not generated after the class end timestamp.

## What Changes

- Split classroom governance readiness into explicit metrics and reason codes.
- Distinguish participants, logged users, durable submissions, required
  evidence coverage, scoreable evidence coverage, scoring coverage, snapshot
  coverage, post-class update-window coverage, and feature-cache freshness.
- Treat latest snapshots that cover latest facts as snapshot-covered even when
  they predate session end, while preserving a separate post-class regeneration
  metric.
- Align report and API naming with the new metric meanings.

## Capabilities

### New Capabilities
- `session-governance-readiness`: Defines report-facing readiness metrics and
  reason-code semantics for interactive classroom governance.

### Modified Capabilities
- None.

## Impact

- Depends on `canonicalize-interactive-lesson-identity` and
  `standardize-manifest-objective-scoring`.
- Affects class session reports, data-quality scripts, teacher/admin report
  payloads, snapshot freshness checks, and feature-cache freshness checks.
- Does not implement scoring or historical recomputation.

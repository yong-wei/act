## Context

Activation can leave consumers on mixed combinations and fallback paths. Retirement is a destructive code change and therefore needs a separate artifact-backed gate. The immutable legacy audit manifest (34 batches, 4,891 members) and crosswalk remain audit/history even when readers disappear.

## Series Dependencies

- Depends on: `activate-versioned-knowledge-consumers`.

## Goals / Non-Goals

**Goals:**

- Prove all new content and active consumers use Authority/Projection identities.
- Make fallback hits, historical reads, rollback snapshots, and one incremental upgrade auditable.
- Remove only obsolete runtime dependencies after all gates pass.

**Non-Goals:**

- Do not activate a new Authority/Projection combination or alter consumer pointers.
- Do not delete legacy audit/crosswalk/history artifacts or rewrite LearningFacts.
- Do not deploy remotely or remove upstream ActKG compatibility contracts.

## Decisions

### 1. Preconditions

Retirement requires: (a) repository scan proves no new authoring/runtime content writes old IDs; (b) migrated consumer fallback hit counters are zero over a defined evidence window; (c) Canonical LearningFacts and Konling are active under their versioned combinations; (d) at least one complete ActKG Delta upgrade has run through impact/rebuild/activation/rollback evidence; and (e) prior rollback snapshots/manifests are archived and digest-verified.

### 2. Retirement manifest

The manifest records current HEAD, activation combinations, fallback counters/window, old-ID scan digest, incremental-upgrade receipt, rollback archive identities, and each removed dependency. It is immutable and must be reviewed before deletion. Missing evidence fails closed.

### 3. Removal scope

Delete old graph/card direct readers, global CourseCoverage selector dependencies, and fallback code only when no active import/history path requires them. Keep legacy audit manifest, old-to-Canonical crosswalk, historical snapshot readers/storage, and compatibility adapters needed for historical LearningFact reads.

### 4. Separation from activation

Retirement has a distinct change/PR and cannot modify activation pointers. A failed retirement leaves active consumers and rollback artifacts unchanged; rollback of retirement restores code/runtime from the archived release, not a new mixed selector.

## Risks / Trade-offs

- Zero fallback telemetry can be false if coverage is incomplete; require a complete consumer inventory and evidence window, and fail closed on unknown consumers.
- Keeping history/crosswalk artifacts costs storage but preserves auditability and historical reads.

## Migration Plan

Run preflight scanners and telemetry export, archive rollback artifacts, review the retirement manifest, remove narrowly scoped dependencies, and rerun consumer/historical read tests. Do not change activation or remote deployment.

## Open Questions

None. Preconditions and retention boundary are fixed.

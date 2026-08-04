## Why

Legacy graph/card readers and the old CourseCoverage runtime should not be removed while any consumer or rollback path still depends on them. After per-consumer activation is stable, retirement must be an independently reviewable, fail-closed change with measurable fallback and migration evidence.

## Series Dependencies

- Depends on: `activate-versioned-knowledge-consumers`.

## What Changes

- Add a retirement gate requiring no new content with old IDs, zero fallback hits for migrated consumers, Canonical facts/Konling cutover, one completed ActKG incremental upgrade, and archived rollback artifacts.
- Remove old runtime readers and selector dependencies only after the gate passes.
- Preserve immutable legacy audit manifest, old-to-Canonical crosswalk, historical snapshots, and rollback documentation.
- Keep retirement separate from activation; this change MUST NOT switch consumers or combine with the activation PR.

## Capabilities

### New Capabilities

- `legacy-knowledge-runtime-retirement`: Evidence-bound removal of legacy runtime dependencies with retained audit/rollback artifacts.

### Modified Capabilities

None. Existing activated consumer contracts remain the authority for readiness evidence.

## Impact

- Legacy graph/card readers, old CourseCoverage selector/runtime dependencies, fallback telemetry and retirement manifest.
- No new database table, remote deployment, upstream semantic review, or deletion of historical evidence.

## Why

Most standard interactive courses still build finalization telemetry by hand with `buildSessionFinalizeTelemetry`, while module 5 uses the newer shared finalization service. The finalization layer should be rewritten as one standard adapter, not a thin wrapper around the old handwritten path.

## What Changes

- Delete course-local finalization branches that import or call `buildSessionFinalizeTelemetry`.
- Rewrite the shared finalization adapter so it owns the finalization payload, session close, reporting, snapshot, cache, and quality-status sequence directly.
- Migrate every standard interactive course from 2-1 through 5-6 to the shared finalization adapter after early-unit manifest migration completes.
- Add guards proving no standard course keeps direct `trackSessionFinalize(buildSessionFinalizeTelemetry(...))` logic.

## Capabilities

### New Capabilities

### Modified Capabilities
- `session-finalization-quality`: Shared finalization must cover all standard interactive courses and must not wrap the old handwritten finalization builder.
- `course-data-quality-gates`: Governance gates must detect finalization bypasses across all standard courses.

## Impact

- `src/lib/data-governance/interactive-session-finalization.ts`
- `src/lib/data-governance/session-finalize-telemetry.ts`
- `src/lib/unit-*-course.ts` finalization callbacks
- `src/features/interactive/__tests__/module5-submission-migration.test.ts` or successor governance gate tests.

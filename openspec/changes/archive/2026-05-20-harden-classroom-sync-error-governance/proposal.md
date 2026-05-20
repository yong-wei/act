## Why

Production classroom sessions can generate large numbers of `sync_error` rows from repeated polling failures, aborted requests, or hidden tabs. Raw errors are useful for debugging, but they currently inflate reports and obscure whether a class had a real service incident.

## What Changes

- Aggregate repeated sync failures into incident-level telemetry.
- Add recovery telemetry so transient failures are distinguishable from unresolved incidents.
- Classify sync failures by source, failure kind, HTTP status, timeout, abort, hidden-tab state, and affected users.
- Preserve raw diagnostics while reducing noisy governance summaries.
- Update reports to show raw error count, incident count, severity, dominant source, and affected users.

## Capabilities

### New Capabilities

- `sync-error-incident-governance`: Incident-level sync error telemetry and report classification.

### Modified Capabilities

- None.

## Impact

- `src/features/interactive/session-framework/fetch-diagnostics.ts`
- `src/features/interactive/session-framework/use-session-progress-channel.ts`
- `src/features/interactive/session-framework/use-session-state-channel.ts`
- `src/features/interactive/session-framework/use-student-lesson-session.ts`
- `src/features/interactive/session-framework/use-teacher-lesson-session.ts`
- `src/features/interactive/session-framework/use-course-event-tracking.ts`
- `src/lib/data-governance/session-reports.ts`

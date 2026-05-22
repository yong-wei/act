## Why

Module 5 lessons duplicate finishSession plus trackSessionFinalize order. Finalization should coordinate session_finalize, session closing, report refresh, snapshots, cache freshness, and quality status through one governed closure path.

## What Changes

- Add a shared finalizeInteractiveLessonSession or equivalent service.
- Record session_finalize with countAfterSessionEnd, current and final step ids, completion ratio, and outcome.
- Queue or run report refresh, student snapshots, class snapshots, and cache refresh.
- Expose captured, materialized, summarized, and cached phases in data-quality reporting.

## Capabilities

### New Capabilities

- `session-finalization-quality`

### Modified Capabilities

- None.

## Impact

- module 5 teacher session finalizers
- session finalization utilities
- data-governance worker queues
- session data-quality report

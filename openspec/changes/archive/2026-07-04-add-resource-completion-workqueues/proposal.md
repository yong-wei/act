## Why

The current completeness helpers expose aggregate blockers, but large manual review batches need stable, claimable worklists by resource family, LearningGoal, graph domain, missing-field code, and review status.

## What Changes

- Emit stable workqueue JSON/Markdown grouped by resource family, LearningGoal, graph domain, missing-field code, and suggested review batch.
- Preserve privacy-minimized output and raw-content exclusion.
- Add tests proving each queue is deterministic, deduplicated, and references stable candidate ids from existing helper output.

## Impact

- Adds a staged resource-completion batch under `resource-path-readiness`.
- Requires helper before/after evidence and independent review before downstream gates can rely on the result.
- May update resource governance data, helper output, tests, and spec deltas within this change boundary.

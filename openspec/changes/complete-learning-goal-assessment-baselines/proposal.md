## Why

The LearningGoal baseline matrix shows all 9 goals missing diagnostic, practice, checkpoint, remediation, and terminal-validation where required baseline categories, and some goals also lack concept or terminal-validation coverage.

## What Changes

- Reuse existing static bank, Prisma Question rows, AC-Q files, iCourse objective items, K/A/Q foundation items, and manually authored checkpoint items before creating new items.
- Manually review every counted item for LearningGoal, K/A/Q objective, graph node, difficulty, cognitive level, misconception, remediation, and source hash.
- Author only the minimum new items needed to close verified gaps.

## Impact

- Adds a staged resource-completion batch under `resource-path-readiness`.
- Requires helper before/after evidence and independent review before downstream gates can rely on the result.
- May update resource governance data, helper output, tests, and spec deltas within this change boundary.

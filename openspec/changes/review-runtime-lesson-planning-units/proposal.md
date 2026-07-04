## Why

Runtime lesson projection output contains 450 runtime lesson steps but only 9 PlanningUnits are human-confirmed. Path planning needs reviewed step-level decisions rather than raw manifest presence.

## What Changes

- Use helper workqueues to split runtime lesson steps by lesson, LearningGoal, and missing fields.
- Manually review step title, route target, graph binding, capability target, estimated time, evidence behavior, and prerequisite role.
- Add reviewed disposition and parent/child relationships for non-planning steps.

## Impact

- Adds a staged resource-completion batch under `resource-path-readiness`.
- Requires helper before/after evidence and independent review before downstream gates can rely on the result.
- May update resource governance data, helper output, tests, and spec deltas within this change boundary.

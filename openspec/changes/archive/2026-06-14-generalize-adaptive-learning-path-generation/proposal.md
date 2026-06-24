## Why

Current adaptive learning path behavior is still bound to the `control-correction` goal and may turn low evidence into a visible no-path state. The accepted adaptive path center handoff requires every user, including cold-start learners, to receive executable learning paths without exposing engineering readiness failures.

## What Changes

- Introduce a generic learning-goal path generation contract that is not hard-coded to `control-correction`.
- Require cold-start generation to return starter paths with explicit entry resources, checkpoints, and safe personalization limits.
- Preserve low-confidence and fallback metadata internally while presenting student-facing language as usable path options.
- Persist generic path rounds, selections, rejections, switches, node execution, deviations, and Konling adjustments across goals.
- Keep the existing control-correction path behavior as one registered goal family rather than the only supported planner target.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `adaptive-learning-path-planning`: generalize path planning, persistence, fallback, and execution feedback beyond control-correction.
- `adaptive-learning-center-ui`: require student-facing path generation to produce usable options without exposing internal readiness strings.

## Impact

- Affects adaptive path planner APIs, `/api/learning-paths/plan`, learner-state integration, path persistence, and adaptive practice route behavior.
- Establishes the foundation for later resource-node, Konling, visual UI, execution/history, and product QA changes in this series.
- Does not implement the redesigned UI or new Konling tools directly.

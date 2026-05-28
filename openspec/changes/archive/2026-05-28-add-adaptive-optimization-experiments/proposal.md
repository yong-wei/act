## Why

Contextual bandit, A/B experimentation, long-term strategy memory, and bulk resource operations are valuable but should not be part of the MVP implementation. This change captures the Stage 2 optimization scope so it can be claimed only after Stage 1 path and Konling evidence are stable.

## What Changes

- Add contextual bandit reranking only for local alternatives after deterministic rules+graph feasible paths exist.
- Add stratified experiment assignment and reporting for current recommendation cards, rules+graph path, rules+graph+bandit, and Konling intervention variants.
- Add analytics for path adoption, deviation, correction success, explanation clicks, intervention acceptance, 48-hour follow-through, learner-state quality, and low-confidence rate.
- Add long-term semantic learner memory and strategy memory after privacy audit.
- Extend teacher ResourceNode management to bulk mapping, policy review, coverage dashboards, and system-owned issue triage.

## Capabilities

### New Capabilities
- `adaptive-learning-optimization-experiments`: Defines Stage 2 local bandit reranking, experiment assignment/reporting, long-term strategy memory, and expanded operations.

### Modified Capabilities
- None.

## Impact

- Affects path planner reranking, evaluation/experiment reporting, Konling memory, and teacher resource operations.
- Depends on `implement-rule-graph-learning-path-mvp`, `upgrade-konling-adaptive-agent-runtime`, and `add-teacher-resource-node-management`.
- Explicitly keeps reinforcement learning and mature hybrid planners out of production scope.

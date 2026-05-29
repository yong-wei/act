## Why

The current platform mostly produces recommendation-card jumps, not explicit personalized learning paths. The report's MVP requires rules plus graph search, constrained planning, serializable path records, and map/timeline/evidence visualization before contextual bandit or reinforcement learning.

## What Changes

- Implement Stage 1 path planning with rules plus graph search over learner state and ResourceNodes.
- Enforce prerequisite, time budget, teacher policy, resource availability, privacy, risk-intervention, and terminal constraints.
- Score candidate paths with a multi-objective function for learning gain, engagement, constraint satisfaction, diversity, fatigue, and dropout risk.
- Add serializable plan, node, alternative, explanation, execution status, deviation, correction attempt, and feedback payloads for downstream persistence.
- Expose map, timeline, and evidence visualization payloads.

## Capabilities

### New Capabilities
- `adaptive-learning-path-planning`: Defines constrained rules+graph path generation, objective scoring, visualization payloads, and execution feedback.

### Modified Capabilities
- None.

## Impact

- Affects path planning contracts, ResourceNode consumers, and downstream evaluation-event payloads.
- Depends on `build-adaptive-learner-state-service` and `register-path-plannable-resource-nodes`.
- Explicitly excludes contextual bandit, reinforcement learning, long-horizon hybrid planners, UI routes, API routes, and Prisma migrations.

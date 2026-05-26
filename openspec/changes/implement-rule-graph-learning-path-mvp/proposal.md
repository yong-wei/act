## Why

The current platform mostly produces recommendation-card jumps, not explicit personalized learning paths. The report's MVP requires rules plus graph search, constrained planning, path persistence, and map/timeline/evidence visualization before contextual bandit or reinforcement learning.

## What Changes

- Implement Stage 1 path planning with rules plus graph search over learner state and ResourceNodes.
- Enforce prerequisite, time budget, teacher policy, resource availability, privacy, risk-intervention, and terminal constraints.
- Score candidate paths with a multi-objective function for learning gain, engagement, constraint satisfaction, diversity, fatigue, and dropout risk.
- Persist plans, nodes, alternatives, explanations, execution status, deviations, correction attempts, and feedback.
- Expose map, timeline, and evidence visualization payloads.

## Capabilities

### New Capabilities
- `adaptive-learning-path-planning`: Defines constrained rules+graph path generation, objective scoring, visualization payloads, and execution feedback.

### Modified Capabilities
- None.

## Governance Contract Dependency

This change consumes `establish-adaptive-learning-governance-contracts` through learner-state and ResourceNode prerequisites, and directly for path-event envelope fields, privacy-safe path explanations, feature flag fallback behavior, and API/example handoff requirements.

## Impact

- Affects lesson/learning center routes, path services/APIs, ResourceNode consumers, and evaluation-event emission.
- Depends on `build-adaptive-learner-state-service` and `register-path-plannable-resource-nodes`.
- Explicitly excludes contextual bandit, reinforcement learning, and long-horizon hybrid planners.

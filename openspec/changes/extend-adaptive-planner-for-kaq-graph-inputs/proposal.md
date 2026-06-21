## Why

After LearningGoal packages, ResourceNode graph profiles, goal subgraphs, and artifact versions exist, the adaptive planner must consume them directly. Keeping planning on old goal id and target arrays would leave the graph work as documentation rather than path-generation input.

## What Changes

- Extend the existing adaptive planner contract instead of creating a parallel planner.
- Allow planner requests to consume LearningGoal packages, ExpandedGoalSubgraph, ResourceNode graph profile metadata, ResourceCoverage overlay, Learner/Class overlay, and version refs.
- Keep Stage 1 planning as deterministic rules plus graph search; no contextual bandit or RL in this change.
- Preserve path round, execution, deviation, correction, Konling path tool, and terminal validation compatibility.
- Ensure generated paths include graph/resource/overlay limitations and student-safe explanations.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `adaptive-learning-path-planning`: planner inputs and outputs must support graph-driven LearningGoal package context.
- `konling-agent-runtime`: existing path-generation tools must be able to pass governed graph-driven planner parameters without expanding permissions.
- `resource-node-registry`: planner must consume ResourceNode graph profile metadata without bypassing audit.

## Impact

- Affects `src/lib/adaptive-learning-path-planner.ts`, path round persistence, Konling path tool adapters, planner tests, and path-center payloads.
- Depends on LearningGoal packages, resource graph profiles, goal subgraph expansion, artifact versioning, the archived `graph-resource-coverage-overlay` capability, and active change `add-learner-class-graph-overlays`.
- Treats missing overlay inputs as governed limitations or fallbacks, and does not reimplement resource coverage or learner/class overlay materialization in this planner change.
- Does not implement ranker, CP-SAT repair, or contextual bandit.

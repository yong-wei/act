## Why

The graph-driven planner can consume LearningGoal, subgraph, overlay, ResourceNode profile, and version inputs after the first batch. It still needs a resource-learner matching layer that ranks audited candidates before path assembly. Without a ranker, the planner risks either selecting a single coarse resource or using ad hoc ordering that cannot explain why a resource fits a learner and goal.

This change adds a deterministic, explainable matching ranker that stays downstream of ResourceNode audit and upstream of path generation.

## What Changes

- Add a resource retrieval and ranking contract for graph-driven path planning and Konling recommendations.
- Score audited candidates using graph coverage, capability contribution, evidence potential, preference fit, accessibility, freshness, time cost, and cognitive load.
- Support scene-specific weights for path, Konling, diagnosis, and prep-pack use.
- Expose feature contributions and rejection reasons.
- Preserve ResourceNode audit as the path eligibility authority.

## Capabilities

### New Capabilities

- `resource-learner-matching-ranker`: Defines governed candidate retrieval, filtering, scoring, and explanation for graph-aware resources.

### Modified Capabilities

- `adaptive-learning-path-planning`: Planner may consume ranked candidate sets but remains responsible for path assembly and constraints.
- `resource-node-registry`: Ranker uses ResourceNode graph profiles and PlanningUnit audit rather than raw chunks as path nodes.
- `learning-evidence-rag-corpus`: Retrieval projections may contribute citation and semantic signals without granting path eligibility.

## Impact

- Affected areas: future `src/lib/adaptive-planning/resource-retrieval.ts`, `src/lib/adaptive-planning/resource-ranker.ts`, `src/lib/adaptive-learning-path-planner.ts`, ResourceNode tests, and planner tests.
- Depends on #640, ResourceNode graph profiles, resource coverage overlay, learner/class overlays, goal subgraph expansion, and artifact versioning.
- Does not implement CP-SAT repair, bandit reranking, or a vector database migration.

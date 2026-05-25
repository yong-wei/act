## Context

The report recommends rules and graph search as the MVP core. Contextual bandit should only rerank local alternatives after feedback exists; reinforcement learning should not be part of the production planner.

## Decisions

### Use feasible path DAGs as the contract

The planner returns a plan DAG with current node, next nodes, alternatives, estimates, and explanations. A fallback state is returned when evidence or mappings are insufficient.

### Keep the objective explainable

Candidate scoring considers expected learning gain, engagement, constraint satisfaction, diversity, fatigue, and dropout risk. The selected path and rejected alternatives include reason metadata.

### Visualization is required for MVP

Map, timeline, and evidence views are not optional UI polish; they are the explanation surface that makes the path inspectable for students and teachers.

## Risks / Trade-offs

- Path planning can look more precise than the evidence supports; every response must expose confidence and source coverage.
- Directly replacing recommendation cards would be risky; this change keeps compatibility surfaces and feature flags.

## Migration Plan

1. Add path plan models and APIs.
2. Generate paths from learner state and ResourceNode graph.
3. Add visualization payloads.
4. Record feedback and deviations.
5. Leave bandit and experiments to a later change.

## Open Questions

- None.

## Context

The report recommends rules+graph as the MVP, contextual bandit for local resource choice after feedback exists, and reinforcement learning only as mature-stage research. This change isolates that later optimization layer.

## Decisions

### Bandit only reranks local alternatives

Bandit can reorder feasible next ResourceNodes that satisfy the same path role. It cannot generate paths, skip constraints, or replace graph feasibility checks.

### Experiments are stratified and privacy-safe

Experiment assignment uses class, cohort, and initial ability strata where available. Reports include completeness/confidence markers and privacy-safe aggregation.

### Long-term memory is gated

Semantic learner memory and strategy memory require prior intervention outcomes, privacy audit coverage, and evaluation instrumentation.

## Risks / Trade-offs

- Bandit may be mistaken for a planner; contract language restricts it to local reranking.
- A/B data can be misread when evidence is incomplete; reports must include sample counts and confidence markers.

## Migration Plan

1. Confirm Stage 1 path and intervention events are stable.
2. Add experiment assignment and reporting.
3. Enable local bandit reranking behind a feature flag.
4. Add long-term memory and expanded teacher operations only after privacy review.

## Open Questions

- None.

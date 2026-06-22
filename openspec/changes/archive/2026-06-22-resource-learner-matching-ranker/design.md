## Ranking Pipeline

The ranker should run after graph and governance filters:

1. identify K/A/Q gaps from LearningGoal, ExpandedGoalSubgraph, and overlay;
2. retrieve candidate ResourceNodes and citation/retrieval projections by graph refs and scene;
3. discard candidates blocked by privacy, teacher policy, unavailable launch target, readiness, citation requirements, or path audit;
4. score remaining candidates with deterministic features;
5. return ranked candidates with feature contributions, limitations, and rejection reasons.

## Features

Initial feature families:

- graph coverage: knowledge, capability, quality node match;
- capability contribution: evidence potential and target level;
- evidence potential: checkpoint, simulation, Arena, rubric, path execution signals;
- learner fit: overlay gap severity, confidence, preference, accessibility;
- resource quality: citation readiness, authority, freshness, version alignment;
- cost: estimated time, cognitive load, effort, readiness risk.

## Scene Weights

The same candidate set may rank differently by scene:

- path: feasibility, evidence potential, time, readiness;
- Konling: citation readiness, authority, graph relevance;
- diagnosis: evidence coverage, confidence, freshness;
- prep-pack: affected population, teacher actionability, insertion fit.

## Boundaries

The ranker does not assemble a path DAG and does not run bandit logic. It may produce top-k alternatives and explanations for the planner or Konling, but deterministic feasibility and ResourceNode audit remain mandatory.

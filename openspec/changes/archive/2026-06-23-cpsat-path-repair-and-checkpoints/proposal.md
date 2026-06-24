## Why

The graph-driven planner can generate feasible starter paths with deterministic rules and graph search, but some constraints are awkward to satisfy by ordering heuristics alone: total time budget, required checkpoints, terminal validation, locked heavy nodes, and serial/parallel resource conflicts.

This change adds a bounded path constraint repair stage after candidate filtering and ranking. It should not solve against the whole resource library and should not make CP-SAT or any solver package a hard product dependency before an adapter and fallback are defined.

## What Changes

- Add a path constraint repair contract for graph-driven path artifacts.
- Define constraints for time budget, prerequisites, checkpoint coverage, terminal validation, locked/readiness nodes, and serial/parallel rules.
- Add a solver adapter boundary with deterministic fallback behavior.
- Return repaired path artifacts or explicit infeasible reasons.
- Preserve planner, path-round, ResourceNode audit, and terminal-validation contracts.

## Capabilities

### New Capabilities

- `path-constraint-repair`: Defines bounded path repair and checkpoint/terminal validation constraint semantics.

### Modified Capabilities

- `adaptive-learning-path-planning`: Planner may run repair after graph search and ranking, but remains able to return deterministic fallback paths without a solver.

## Impact

- Affected areas: future `src/lib/adaptive-planning/path-constraint-repair.ts`, `src/lib/adaptive-learning-path-planner.ts`, path artifact payloads, and planner tests.
- Depends on #640, graph-driven planner inputs, ResourceNode readiness metadata, resource ranker, and artifact version refs.
- Does not introduce global optimization, full-library ILP, contextual bandit, or RL.

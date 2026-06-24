## Placement

Constraint repair runs after candidate retrieval/ranking and initial graph-search path assembly:

```text
LearningGoal -> subgraph -> overlay gaps -> ranked ResourceNodes -> draft path -> repair -> path artifact
```

The repair input should be small: a draft path plus bounded alternatives, not the full resource registry.

## Constraints

Initial constraints:

- hard prerequisites must precede dependent nodes;
- required checkpoint roles must appear before completion;
- terminal validation policy must be satisfied or explicitly infeasible;
- total time must stay within budget or return budget tradeoffs;
- locked heavy nodes require readiness evidence, completed prerequisite nodes, or fallback nodes;
- serial-only nodes cannot overlap;
- parallelizable supporting resources may be grouped only when path UI can represent that grouping.

## Solver Boundary

The product contract should define a solver adapter rather than committing directly to one package. The first implementation may use deterministic repair with a solver-compatible interface. A later OR-Tools/Z3/WASM adapter can be plugged in after dependency and runtime constraints are evaluated.

## Infeasible Output

Infeasible repair is a normal output. It should return blocking constraints, candidate coverage gaps, missing ResourceNode roles, missing terminal validation, or time budget conflicts. The planner can then show a low-resource fallback or ask for a larger time budget.

## Boundaries

This change repairs path structure and validation coverage. It does not rank resources, create learner overlay, write evidence, or dynamically replan after execution.

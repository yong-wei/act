## 1. Expansion Contract

- [x] 1.1 Define ExpandedGoalSubgraph payload types.
- [x] 1.2 Add graph expansion service boundary and inputs.
- [x] 1.3 Include LearningGoal version and graph version in expansion output.

## 2. Prerequisite Policy

- [x] 2.1 Define planner-safe relation semantics.
- [x] 2.2 Map supported K/A/Q graph relations to prerequisite policy entries.
- [x] 2.3 Surface weak or missing relation semantics as limitations.

## 3. Consumers

- [x] 3.1 Add fixture output for downstream planner tests.
- [x] 3.2 Add fixture output for Konling graph context tests.
- [x] 3.3 Add graph-center goal drill-down payload hooks without making GraphCenter actionable yet.

## 4. Verification

- [x] 4.1 Add deterministic expansion tests.
- [x] 4.2 Add tests for missing graph bindings and inactive nodes.
- [x] 4.3 Add tests proving expansion does not create path rounds or select resources.
- [x] 4.4 Run `rtk openspec validate add-goal-subgraph-expansion-and-prerequisite-policy --strict`.

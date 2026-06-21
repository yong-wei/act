## 1. Expansion Contract

- [ ] 1.1 Define ExpandedGoalSubgraph payload types.
- [ ] 1.2 Add graph expansion service boundary and inputs.
- [ ] 1.3 Include LearningGoal version and graph version in expansion output.

## 2. Prerequisite Policy

- [ ] 2.1 Define planner-safe relation semantics.
- [ ] 2.2 Map supported K/A/Q graph relations to prerequisite policy entries.
- [ ] 2.3 Surface weak or missing relation semantics as limitations.

## 3. Consumers

- [ ] 3.1 Add fixture output for downstream planner tests.
- [ ] 3.2 Add fixture output for Konling graph context tests.
- [ ] 3.3 Add graph-center goal drill-down payload hooks without making GraphCenter actionable yet.

## 4. Verification

- [ ] 4.1 Add deterministic expansion tests.
- [ ] 4.2 Add tests for missing graph bindings and inactive nodes.
- [ ] 4.3 Add tests proving expansion does not create path rounds or select resources.
- [ ] 4.4 Run `rtk openspec validate add-goal-subgraph-expansion-and-prerequisite-policy --strict`.

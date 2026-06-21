## Why

The adaptive path system currently has too few registered learning goals to express the variety of student-facing objectives needed for graph-driven learning. LearningGoal must become the student-facing package of K/A/Q objectives so path planning can expand beyond fixed goal ids while still reusing the existing goal slice, K/A/Q catalog, and adaptive planner contracts.

## What Changes

- Define LearningGoal packages as governed student-facing bundles of knowledge, capability, and quality objectives.
- Extend existing registered goals rather than creating a parallel goal system.
- Require at least eight `path-ready` automatic-control LearningGoals.
- Bind each LearningGoal to K/A/Q objectives, graph nodes, evidence policy, path policy family, resource mix, and terminal validation policy.
- Preserve compatibility for existing `control-correction` and `frequency-response-foundations` path goals.

## Capabilities

### New Capabilities

- `learning-goal-packages`: student-facing K/A/Q goal packages and their governance contract.

### Modified Capabilities

- `adaptive-learning-path-planning`: path generation must accept governed LearningGoal packages as registered goal inputs.
- `kaq-objective-taxonomy`: K/A/Q objectives must be usable as LearningGoal package targets.
- `adaptive-goal-slice-registry`: goal slices must remain compatible with LearningGoal package bindings.

## Impact

- Affects `src/lib/adaptive-learning-path-planner.ts`, K/A/Q objective catalogs, goal slice metadata, and graph-center goal entry payloads.
- Adds no new learner evidence writeback behavior.
- Does not implement teacher custom-goal authoring UI in this change.

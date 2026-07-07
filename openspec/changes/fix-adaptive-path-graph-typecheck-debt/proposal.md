## Why

`tsc --noEmit` reports 10 errors in adaptive path, graph coverage, learner-state, control-correction path round, and assessment coverage tests. These errors come from stale graph/resource coverage fixtures and LearningGoal/path contracts that gained required fields.

## What Changes

- Refresh adaptive path graph fixtures to include current coverage, route, filter, capability-target, and graph-context fields.
- Align LearningGoal assessment and learner-state test fixtures with current enums and nullability.
- Preserve planner behavior and low-resource diagnostics.

## Impact

- Targets 10 current TypeScript errors in 4 files.
- Supports future path-planning work by restoring typed fixture fidelity.

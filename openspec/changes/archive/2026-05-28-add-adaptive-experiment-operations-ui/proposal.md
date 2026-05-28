## Why

Stage 2 adaptive optimization introduces contextual bandit reranking, experiment assignment, long-term strategy memory, expanded teacher operations, and aggregate evaluation reporting. Those controls should not be bundled into the MVP adaptive center or teacher management UI, but the UI series needs a planned surface for them.

## What Changes

- Define Stage 2 UI for experiment variants, assignment health, path and intervention metrics, confidence/completeness, local bandit comparison, long-term memory audit, and teacher bulk operations.
- Keep all Stage 2 controls behind feature flags and prerequisite checks.
- Preserve privacy-safe aggregation and avoid production reinforcement-learning controls.

## Capabilities

### New Capabilities
- `adaptive-experiment-operations-ui`: Defines Stage 2 adaptive experiment, optimization, memory, and teacher bulk-operation UI.

## Impact

- Affects future adaptive operations routes, admin/teacher reporting, Konling memory audit surfaces, and bulk ResourceNode management panels.
- Depends on `add-adaptive-optimization-experiments`, adaptive center UI, and teacher/admin governance workspace UI.

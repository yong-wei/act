## Why

The report identifies the current `LearningPath` model as too light for a closed loop: it stores basic path metadata but not a durable path round with execution state, deviation, intervention, citation, alternatives, or terminal validation. Without a persisted round, students cannot resume a path, Konling cannot read authoritative path context, and teachers cannot audit path outcomes.

## What Changes

- Expand the learning-path contract into a persisted control-correction path round.
- Add execution, deviation, intervention, alternative-path, explanation, and terminal-validation payloads.
- Preserve compatibility with existing `LearningRecommendation` and legacy path readers.
- Define route-handler contracts for plan creation, path read, execution write, deviation write, and intervention write.

## Capabilities

### Modified Capabilities

- `adaptive-learning-path-planning`
- `adaptive-learner-state-service`

## Impact

- Introduces the main durable object for the rest of the series.
- Requires additive database migration and rollback documentation during implementation.
- Does not build the student learning-center UI or teacher report yet.

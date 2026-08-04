## Why

Adaptive path generation currently stores comparison options only inside a mutable `LearningPath` payload and exposes page-local option identifiers. Konling and the adaptive learning center therefore cannot reliably reopen the same generated result, deep-link to one candidate, or preserve an already selected or executing path when a newer generation succeeds.

## What Changes

- Persist each successful generation as an immutable candidate batch owned by the learner and learning goal.
- Give every candidate a stable identifier and retain the planner-produced ordering, policy metadata, executable node payload, explanations, and generation request identity.
- Expose authorized APIs for reading the latest successful batch or a specific batch and candidate.
- Make Konling generation responses and the adaptive learning center reference the same batch identifier.
- Default the path comparison workspace to the latest successful batch while preserving the current selected or executing `LearningPath`.
- Support candidate deep links and retain an explicit route back to the complete comparison.
- Reuse the existing path comparison UI and existing path-choice endpoint; natural-language candidate selection remains outside this change.

## Capabilities

### New Capabilities
- `adaptive-path-candidate-batches`: Defines immutable generated candidate batches, stable candidate identity, authorized retrieval, and separation from selected or executing paths.

### Modified Capabilities
- `adaptive-learning-center-ui`: Makes the existing comparison workspace batch-aware, defaults it to the latest successful batch, and supports candidate deep links without replacing the current path.
- `konling-agent-runtime`: Returns and consumes the persisted batch identity for path-generation results without regenerating or rewriting candidates.

## Impact

- Prisma schema and migration for candidate batch persistence.
- Adaptive path generation persistence and `path-advisor-tool` response contracts.
- Learning-path read APIs and authorization helpers.
- Adaptive learning center state, URL handling, and existing comparison rendering.
- Focused unit, route, and Playwright coverage plus governed browser evidence.

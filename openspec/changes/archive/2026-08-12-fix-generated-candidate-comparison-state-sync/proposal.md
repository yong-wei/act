## Why

Successful adaptive-path generation persists a candidate batch and updates the browser URL, but the current generation page does not immediately observe that new route state. Students receive a success message while the comparison region remains absent until a manual refresh, breaking the generation-to-selection loop that #1327 intended to restore.

## What Changes

- Synchronize a successful generated candidate batch with the current adaptive-path page state without requiring a reload.
- Keep the active-path continuation, generation controls, and newly generated comparison region on the same page.
- Open and focus the comparison module only after the current learner's authorized batch has loaded successfully.
- Preserve deep-link and refresh recovery for the same batch while keeping execution routes free of unrelated candidate comparison UI.
- Add regression coverage for immediate post-generation display, refresh recovery, active-path preservation, and learner authorization boundaries.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `adaptive-learning-center-ui`: Require the generation workspace to display an authorized successful candidate batch immediately in the same integrated path-center surface, without manual refresh or loss of the current active path.

## Impact

- Adaptive learning center route and client-state synchronization.
- Existing candidate-batch loading and comparison-module auto-open behavior.
- Focused component and browser regression tests for generation-to-comparison continuity.
- No planner, candidate ordering, persistence schema, path-selection mutation, or cross-learner authorization changes.

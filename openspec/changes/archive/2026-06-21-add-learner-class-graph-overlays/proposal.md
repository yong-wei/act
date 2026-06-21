## Why

After graph-center and resource coverage are in place, the platform needs learner and class overlays that show mastery, weakness, evidence needs, and class heat without mutating graph body data. This is higher risk than resource coverage because it touches learner-state privacy, teacher class scope, evidence confidence, and student-visible claims.

## What Changes

- Add learner graph overlay payloads keyed by learner, graph domain, and graph node id.
- Add class graph heat overlay payloads keyed by class, graph domain, and graph node id.
- Derive states from server-owned learner state, goal slices, evidence windows, and confidence metadata.
- Add graph-center modes for learner and class heat overlays with clear empty, low-confidence, and unauthorized states.

## Capabilities

### New Capabilities
- `learner-graph-overlays`: learner and class graph-state overlays for graph center.

### Modified Capabilities
- None in this proposal. It consumes existing learner-state and governance contracts.

## Dependencies

- Depends on `build-graph-center-readonly-foundation`.
- Depends on `add-graph-resource-coverage-overlay`.
- Uses existing `adaptive-learner-state-service`, `adaptive-mastery-state`, and privacy governance contracts.

## Impact

- Adds student and teacher-facing graph state modes.
- Does not write graph body data.
- Does not expose raw private evidence or another student's state.

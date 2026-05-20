## Why

The comprehensive simulation workbench parameter drawer still allows its top object and correction tabs to deform when users click between objects, correction states, or long labels. This makes the active context hard to read and creates visible layout jitter during core tuning interactions.

## What Changes

- Stabilize the top object and correction tab dimensions in the parameter drawer.
- Prevent long object names or correction labels from stretching, wrapping unpredictably, or overlapping adjacent controls.
- Add active-state colors for the current drawer tab in both light and dark modes.
- Preserve existing object parameters, correction parameters, lock state, and controller semantics.
- Add focused component or browser assertions for the relevant tab interactions.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `arena-workbench-correction-controls`: parameter drawer tab layout and active-state presentation become stricter for the shared comprehensive simulation workbench.

## Impact

- Affected frontend areas:
  - parameter drawer and correction-control components used by the classic four-view workbench
  - theme classes for active, inactive, hover, and focus tab states
  - tests around object parameters, correction parameters, and drawer tab interactions

## Why

The learning-path report identifies `control-correction` as the first closed-loop competency target that can connect learner state, ResourceNode planning, Konling, simulation, Arena, and teacher reporting. The current adaptive learner state is general-purpose and does not yet expose a stable goal slice for control-system correction. Without a named slice, later path, report, and coaching changes cannot share dimensions, confidence semantics, or privacy rules.

## What Changes

- Define the `control-correction` competency goal and its required learner-state dimensions.
- Map each dimension to governed evidence families, confidence markers, and privacy visibility.
- Define the minimum target levels used by path planning, readiness gates, and teacher reports.
- Require low-evidence and stale-evidence states to be explicit instead of treated as normal mastery.

## Capabilities

### Modified Capabilities

- `adaptive-learner-state-service`
- `adaptive-learning-governance-contracts`

## Impact

- Establishes the common vocabulary consumed by every later change in this series.
- Does not add a new learner-state engine or replace existing adaptive mastery contracts.
- Blocks downstream changes from inventing incompatible control-correction dimensions.

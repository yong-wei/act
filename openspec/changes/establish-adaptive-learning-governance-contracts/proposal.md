## Why

The existing XH-202620 adaptive-learning proposal is too large to execute as one Buddy change. Before implementing learner state, ResourceNodes, path planning, Konling, and optimization, the platform needs a small shared governance contract that fixes the prerequisite gate, privacy model, evaluation event envelope, feature flags, and handoff artifacts for the rest of the series.

## What Changes

- Establish the adaptive-learning prerequisite gate for the seven virtual-simulation-platform-refactor changes.
- Define shared privacy classification, redaction, access audit, and evaluation-event envelope requirements.
- Define shared feature flag, compatibility, rollback, ER/data-dictionary/API-example handoff expectations.
- Keep this change contract-only; it does not implement learner-state, ResourceNode, path-planner, teacher UI, or Konling behavior.

## Capabilities

### New Capabilities
- `adaptive-learning-governance-contracts`: Defines the series-level execution gate, shared privacy/evaluation contracts, compatibility and handoff requirements.

### Modified Capabilities
- None.

## Impact

- Affects later XH-202620 adaptive-learning changes as a dependency.
- Depends on no new runtime code.
- Buddy mode: isolated contract foundation under the `xh202620-adaptive-learning-platform` series.

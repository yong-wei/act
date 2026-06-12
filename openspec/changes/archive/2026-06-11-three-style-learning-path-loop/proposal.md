## Why

The assistant close-loop report requires the platform to move from one generic recommendation to multiple actionable path styles. The current path planner already supports control-correction path rounds, explicit policy families, terminal validation, and displayed path distinction. The missing product behavior is a closed loop where diagnosis produces several clearly different path options, the student selects one, and that choice writes back to preference and strategy evidence.

## What Changes

- Generate a three-style path bundle for control-correction diagnosis: foundation remediation, Arena/simulation sprint, and preference-matched route.
- Require each path option to expose target deficits, resource mix, overlap, effort, terminal validation strategy, and evidence basis.
- Record student selection, rejection, completion, deviation, and helpfulness as governed evidence.
- Feed selection and execution outcomes back into learner-state, diagnosis, and later path planning.

## Capabilities

### Modified Capabilities

- `adaptive-learning-path-planning`
- `adaptive-learner-state-service`
- `evidence-driven-personalization`
- `konling-agent-runtime`

## Impact

- Depends on `control-correction-diagnosis-indicator-engine`.
- Extends path bundle behavior and learner preference writeback.
- Does not implement UI shells beyond the data contracts needed by diagnosis surfaces.

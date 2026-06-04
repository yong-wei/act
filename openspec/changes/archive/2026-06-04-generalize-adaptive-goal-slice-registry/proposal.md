## Why

The control-correction path series will make one goal slice work end to end, but the teaching-assistant report targets the whole automatic-control course. Keeping `control-correction` as the only hard-coded goal would force every future topic to fork learner-state, path, report, and Konling logic.

## What Changes

- Introduce a registered adaptive goal-slice contract that can describe course-wide learning goals beyond control correction.
- Require each goal slice to declare dimensions, target levels, evidence sources, privacy visibility, confidence policy, path/report availability, and validation fixtures.
- Adapt learner-state consumers so unknown or unregistered goals fail tests and produce explicit unavailable states rather than silent fallbacks.

## Capabilities

### New Capabilities

- `adaptive-goal-slice-registry`

### Modified Capabilities

- `adaptive-learner-state-service`

## Impact

- Generalizes the future control-correction baseline into a reusable course-wide mechanism.
- Does not create new path policies, diagnosis narratives, grading, or UI surfaces.
- Depends conceptually on the archived control-correction goal-slice contract, but does not need to wait for the full control-correction path series.

## Context

The current learner-state service already exposes a governed `control-correction` goal slice. Future active changes will make that slice useful for path planning, Konling coaching, teacher reports, and demo validation. The next architectural step is to remove goal-specific hard-coding while preserving the same privacy and confidence discipline.

## Goals / Non-Goals

**Goals:**

- Define a goal-slice registry shape with stable goal ids, dimensions, evidence source families, target levels, privacy classes, and validation contracts.
- Keep `control-correction` as the first registered goal and fixture.
- Make learner-state, planner, report, and Konling consumers read goal metadata from the registry where practical.
- Add guard tests that reject unregistered or undeclared goal fields.

**Non-Goals:**

- Building every course goal slice in this change.
- Replacing the six primary competency model.
- Recomputing historical learner-state snapshots.

## Decisions

### Decision 1: Registered goal metadata is the source of truth

Goal-specific dimensions must be declared in one registry contract instead of being scattered across learner-state, UI, planner, and report code.

The registry contract must distinguish competency dimensions from non-dimensional learner-state field families. Path execution context, recent path rounds, terminal validation state, and explicit no-active-path state are not competency dimensions, but they are still part of the `control-correction` learner-state contract when downstream path consumers require them.

### Decision 2: Control correction remains the canonical fixture

The existing `control-correction` slice should become the regression fixture that proves a registered goal can preserve current behavior.

### Decision 3: Unregistered goals fail closed

Consumers should return explicit unsupported-goal or unavailable states when a goal is not registered. They should not silently map unknown goals to general learner state.

## Validation

- Unit tests SHALL prove `control-correction` can be read through the registry and retains its declared dimensions.
- Compatibility tests SHALL prove `control-correction` retains active path context, terminal validation state, recent path references, and no-active-path state after registry filtering.
- Contract tests SHALL reject unregistered goals and undeclared dimensions.
- `rtk openspec validate generalize-adaptive-goal-slice-registry --strict` SHALL pass.

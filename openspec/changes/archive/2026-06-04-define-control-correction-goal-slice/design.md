## Context

The report recommends a control-system correction vector that includes knowledge, design decision, simulation, Arena, reflection, and AI-collaboration evidence. Existing learner state and governance specs already define source coverage, confidence, privacy classes, and rollback behavior. This change binds those existing contracts to one named goal.

## Goals / Non-Goals

**Goals:**

- Define the canonical `control-correction` goal id.
- Define dimensions for time-domain analysis, root-locus reasoning, frequency-domain margin analysis, method selection, constraint tradeoff, simulation validation, Arena transfer, reflection, and AI-collaboration evidence.
- Require each dimension to carry score, level, evidence count, freshness, source coverage, confidence, and privacy class.
- Provide acceptance fixtures for strong, partial, stale, and missing evidence.

**Non-Goals:**

- Creating the student learning-center UI.
- Persisting path rounds or execution logs.
- Changing scoring weights beyond naming the required dimension contract.

## Decisions

### Decision 1: The slice is a governed learner-state projection

`control-correction` is a projection over existing governed evidence and snapshots. It must be rebuildable or explainable from existing learner-state inputs and must not become a separate opaque profile.

### Decision 2: Low confidence is a first-class state

Missing simulation, Arena, reflection, or AI-collaboration evidence must be represented explicitly so downstream path planning can generate fallback or evidence-gathering paths.

### Decision 3: Dimensions are stable API fields

Later changes may tune scoring internals, but the dimension ids and target-level vocabulary must remain stable for stored paths, reports, and demo fixtures.

## Validation

- Unit tests SHALL cover dimension assembly from complete, partial, stale, and missing evidence.
- Contract tests SHALL verify privacy classes for each field family.
- `rtk openspec validate define-control-correction-goal-slice --strict` SHALL pass before implementation is accepted.

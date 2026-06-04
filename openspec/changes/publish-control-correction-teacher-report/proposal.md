## Why

The report requires teacher-visible proof that the control-correction path improves learning and transfers to simulation/Arena performance. Existing teacher insights expose evidence coverage, but there is no path-specific report with adoption, completion, competency lift, intervention acceptance, citation coverage, and exportable evidence.

## What Changes

- Add a teacher report contract for `goal=control-correction`.
- Aggregate path adoption, completion, deviation, competency lift, simulation pass rate, Arena valid submission rate, Konling intervention acceptance, intervention-after-success, citation coverage, and resource contribution.
- Provide student drilldown with scoped evidence summaries and no raw private payload leaks.
- Define export behavior for review, teaching, and demo use.

## Capabilities

### Modified Capabilities

- `teacher-evidence-governance`
- `adaptive-learning-optimization-experiments`

## Impact

- Gives teachers and evaluators an observable closed-loop outcome surface.
- Depends on path persistence, evidence-cache integration, and simulation/Arena validation.
- Does not introduce experimental optimization policies or bandit/RL behavior.

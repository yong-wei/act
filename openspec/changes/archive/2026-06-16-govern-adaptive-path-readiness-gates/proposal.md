## Why

The adaptive path center currently treats low ability as a deficit to optimize, not as an execution constraint. A student such as `20230010102601` can receive immediate Arena or heavy simulation nodes even when control-modeling and parameter-tuning competency are still zero, making the generated path visibly unusable.

## What Changes

- Add ResourceNode readiness metadata for adaptive path execution.
- Add planner readiness checks before path option generation and before node activation.
- Lock heavy nodes such as Arena, advanced simulation, control workbench validation, and terminal checkpoints until competency, prerequisite, and result-reference requirements are satisfied.
- Convert readiness outcomes into student-facing messages and keep internal reason codes out of the learner UI.
- Use the 2026-06-16 closed-loop design as an implementation contract, not an optional reference.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `adaptive-learning-path-planning`: add readiness-gated path option generation, active-node selection, and dependent-node advancement rules.
- `resource-node-registry`: add path readiness metadata needed by the planner and execution surface.
- `adaptive-learning-center-ui`: render locked and preparation states in student-facing language.

## Impact

- Affects adaptive path planner inputs and outputs, ResourceNode metadata, path option payloads, path execution activation, and `/assessment/adaptive-practice` locked-state rendering.
- Design source: `artifacts/product-design-audits/adaptive-learning-path-2026-06-16-closed-loop-design/design-spec.md`.
- Current-state evidence: `artifacts/product-design-audits/adaptive-learning-path-2026-06-16-current-audit/audit-notes.md` and screenshots in the same directory.

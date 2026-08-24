## Why

Issue #1181 exposes that the AI companion treats every control-learning attempt as PID tuning: its input fields, constraint thresholds, diagnosis language, and next actions are fixed to `kp`/`ki`/`kd`, overshoot, comfort, and stability margin. This produces misleading guidance for MPC and black-box identification, despite the Arena task catalog already defining their allowed methods and official metric profiles.

## What Changes

- Derive an Arena companion context from the registered challenge task, selected allowed method, and `MetricProfile` rather than PID-only client fields.
- Make intervention detection, constraint explanation, diagnostic emphasis, highlighted inputs, and learning actions consume the derived context while retaining current generic/PID behavior for callers outside Arena.
- Update the companion panel to collect only the parameters and observable metrics applicable to the selected Arena method.
- Ensure the server re-resolves task and method context instead of trusting client-provided thresholds or labels.
- Preserve the distinction between advisory diagnosis and governed wrong-answer attribution: companion output may describe observed metrics and suggest practice, but must not create or assert a formal error cause, official score, LearningFact, portrait, or leaderboard result.

## Capabilities

### New Capabilities
- `control-method-aware-companion-guidance`: Task-derived, method-aware AI companion diagnosis for Arena control learning attempts, including evidence and attribution boundaries.

### Modified Capabilities
- `arena-student-diagnostic-feedback`: Arena guidance must remain distinct from official submission feedback and hidden-scenario evaluation details.

## Impact

- Affects `src/features/ai/companion/`, the authenticated intervention generate route, and governed Konling intervention creation.
- Adds focused unit and route-contract coverage for PID compatibility, MPC guidance, black-box guidance, and task/method validation.
- Reuses the static Arena task and metric-profile registry; no schema, migration, official evaluator, ranking, LearningFact, or portrait changes are introduced.

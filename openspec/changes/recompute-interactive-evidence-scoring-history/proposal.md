## Why

After structural objective scoring is standardized, historical interactive
evidence needs a reproducible way to refresh derived scoring context. Existing
StudentStepResponse and LearningFact rows must preserve raw submissions while
their derived score fields and trace links can be audited and repaired.

## What Changes

- Add a dry-run and apply path for historical manifest objective scoring
  recomputation.
- Recompute derived score, correctness, scoring detail, and scoring version
  from raw submitted evidence.
- Preserve raw InteractionLog, StudentStepResponse, and LearningFact evidence.
- Report affected lessons, sessions, steps, users, score deltas, and trace-link
  repairs.
- Diagnose or repair facts with sourceEventId but missing sourceLogId.

## Capabilities

### New Capabilities
- `interactive-evidence-scoring-recompute`: Defines historical recomputation
  and trace repair for manifest objective scoring evidence.

### Modified Capabilities
- None.

## Impact

- Depends on `standardize-manifest-objective-scoring`.
- Affects data-governance scripts, StudentStepResponse derived context, and
  LearningFact derived context.
- Does not define scoring rules and does not change report readiness semantics.

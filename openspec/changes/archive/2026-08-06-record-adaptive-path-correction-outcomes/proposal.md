## Why

P1 derives correction candidates and P2 lets a learner make an authoritative decision, but the journey currently has no evidence-bounded projection of what happened after a confirmed correction. Students cannot distinguish an observed improvement from an unverified correction, while teacher reporting needs a privacy-safe aggregate rather than raw student evidence. This phase closes the learning loop without claiming that a correction caused an outcome.

## What Changes

- Derive a result state for each confirmed correction from evidence recorded after the decision snapshot.
- Expose the result state and its evidence limitations in the student path journey.
- Use four controlled states: `improved`, `needs-review`, `pending-verification`, and `indeterminate`.
- Link eligible post-confirmation checkpoints, node completions, and terminal validation references to the result projection.
- Expose only redacted aggregate counts and rates to teachers; do not add student-identifying drilldowns to this phase.
- Keep P1/P2 candidate derivation, decision writes, path application, and append-only history unchanged.
- Do not infer causality, compare unsupported pre/post scores, or treat missing evidence as failure.

## Capabilities

### New Capabilities

- `adaptive-path-correction-outcomes`: Evidence-bounded student result states and redacted teacher aggregates for confirmed path corrections.

### Modified Capabilities

- None. The new projection consumes existing path, decision, execution, checkpoint, and terminal-validation contracts without changing their requirements.

## Impact

- Adaptive path journey projection and student-facing path status UI.
- A server-authoritative read projection or route for correction outcomes.
- Teacher control-correction reporting with aggregate-only outcome metrics.
- Focused unit/route/UI tests, typecheck, strict OpenSpec validation, and browser evidence.
- No new database model or migration is required unless existing persistence cannot carry the derived projection.

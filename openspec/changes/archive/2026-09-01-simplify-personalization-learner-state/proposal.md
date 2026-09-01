## Why

Personalization now has a learner-state public API, application reader, adapters, ports, and a pure reducer contract, but the canonical `internal.ts` still combines contracts, database-facing reads, compatibility projection, portrait fencing, evidence assembly, goal slices, role redaction, and reduction in 111,670 bytes / 2,754 lines. The `reducer.ts` entry is only an 85-byte re-export, so the source layout obscures the actual pure boundary and preserves duplicate normalization and compatibility logic.

## What Changes

- Add characterization coverage for the current learner-state reducer and role/goal projections before editing the implementation.
- Invoke the `code-simplification` skill only after C0–C2 establish the canonical Personalization owner, Assessment read boundary, Learning Record read boundary, plugin scope, and deletion set.
- Make the pure reducer, normalized input boundary, read adapters, application assembly, and role projection responsibilities explicit; convert each governed LearningFact once.
- Remove only proven duplicate guards, matchers, compatibility wrappers, and one-implementation interfaces while retaining all required authority, privacy, no-evidence, freshness, identity, and concurrency protections.
- Require before/after production metrics and a net reduction in production bytes and semantic concepts; moving the same implementation into more files is not success.

## Capabilities

### New Capabilities

- None. This is a behavior-preserving simplification of the existing Personalization learner-state contract.

### Modified Capabilities

- `personalization-learner-state-reducer`: Add explicit reducer/application separation, code-simplification, net-reduction, and invariant evidence requirements without changing learner-state semantics.

## Impact

- Primarily affects `src/features/personalization/learner-state/internal.ts`, `reducer.ts`, `application/read-learner-state.ts`, adapters/ports, and canonical learner-state tests after C2.
- Requires reducer/application characterization, role/privacy/no-data tests, typecheck, lint, architecture fitness, Ponytail review, and before/after metrics.
- Does not alter LearningFact schema, portrait snapshots, Assessment attempts, calculation versions, feature flags, production data, deployment, or selectors.

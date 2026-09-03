## Why

After the Assessment and adaptive ownership migrations, Personalization has one canonical `PlanLearningPath` boundary, but its implementation still concentrates goal catalog, cold-start projection, eligibility, ranking, repair, assembly, explanation, serialization, and feedback logic in a 250,111-byte / 6,182-line `assemble-plan.ts`. The next step is behavior-preserving simplification of that canonical implementation, with evidence that production bytes and concepts actually decrease rather than merely moving code into more files.

## What Changes

- Add characterization coverage for the canonical `PlanLearningPath` use case before changing its implementation.
- Invoke the `code-simplification` skill only after C0–C2 have established the owner, consumers, deletion boundary, and non-deletable invariants.
- Simplify the canonical path assembly responsibilities in bounded passes: normalize once, filter hard eligibility before ranking, repair once, assemble once, and build explanations/serialization without duplicating state.
- Preserve path results, fallback/error semantics, policy bundles, prerequisite and terminal-validation constraints, provenance, privacy, revision, append-only feedback, and plugin ownership.
- Require before/after production metrics, public-export and test comparisons, and a net reduction in production bytes and semantic concepts; splitting an equal-sized implementation is not completion.

## Capabilities

### New Capabilities

- None. This is a behavior-preserving simplification of the existing Personalization path-planning contract.

### Modified Capabilities

- `personalization-path-planning-pipeline`: Add explicit characterization, simplification, net-reduction, and invariant evidence requirements without creating another planner or changing its runtime contract.

## Impact

- Primarily affects `src/features/personalization/path-planning/internal/assemble-plan.ts`, its canonical application/public API, and adjacent path-planning helpers after C2.
- Requires existing path planner unit/contract tests, path route/consumer characterization, typecheck, lint, architecture fitness, Ponytail review, and before/after metrics.
- Does not alter path schemas, database data, Learning Record facts, Assessment attempts, production selectors, deployment, or user-visible policy semantics.

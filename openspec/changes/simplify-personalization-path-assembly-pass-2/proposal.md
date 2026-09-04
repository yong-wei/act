## Why

`assemble-plan.ts` remains a 247 KB center after the first pass. Its behavior is well covered, so the next useful step is to remove repeated normalization, filtering, repair, and explanation work without changing path results.

## What Changes

- Simplify one planning stage at a time behind the existing `PlanLearningPath` use case.
- Reuse normalized identities and already-computed planning facts instead of recomputing them across stages.
- Delete equivalent filters, forwarding helpers, and redundant state forms when tests prove them unnecessary.
- Keep path ordering, eligibility, prerequisites, redaction, persistence, and explanations unchanged.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personalization-path-planning-pipeline`: require a second behavior-preserving simplification pass with measurable net reduction and no new planner surface.

## Impact

- Primary code: `src/features/personalization/path-planning/internal/assemble-plan.ts` and its existing tests.
- No public API, schema, route, persistence format, or product behavior change.

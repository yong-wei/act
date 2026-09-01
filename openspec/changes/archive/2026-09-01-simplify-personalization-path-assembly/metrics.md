# Before/after metrics — simplify-personalization-path-assembly

Rollback revision: `a03e14aa3b108d7958df07f8d623332b9b92944a` (`origin/integration` after C2 #1776).

Canonical owner: Personalization `PlanLearningPath` / `assembleAdaptiveLearningPathPlan`. C2 retired `src/features/adaptive/` and `src/lib/adaptive-*` production entrypoints.

## Scope

Production module: `src/features/personalization/path-planning/**` excluding `__tests__`.
Primary file: `internal/assemble-plan.ts`.
Public export set unchanged.

## Characterization

Existing tests run unchanged on `a03e14aa3b`: 177 passed (`assemble-plan`, `plan-learning-path`, `prerequisite-planner`, `control-correction-real-seed-planner`).

## Pass

One bounded explanation/serialization + SAR-resolve pass:

- Collapse four identical pairwise diversity loops into `pairwisePolicies`.
- Merge `resolveSarCandidateNodeForPath` into `resolveSarCandidateNode`.
- Compute graph-coverage and blocked-node redaction once.

Did not split files. Did not add a planner, schema, or `src/lib` business entry.

## Metrics

| Metric | Before | After | Delta |
| --- | --- | --- | --- |
| Module bytes | 489323 | 486779 | -2544 |
| Module LOC | 12794 | 12751 | -43 |
| `assemble-plan.ts` bytes | 250248 | 247704 | -2544 |
| `assemble-plan.ts` LOC | 6182 | 6139 | -43 |
| `assemble-plan.ts` functions | 175 | 171 | -4 |
| Public exports | unchanged | unchanged | 0 |
| Tests | 177 | 177 | 0 |

25% byte reduction not achieved; net production bytes and function count both declined. Further catalog/factory compression would add wrappers without deleting a second authority, so it was skipped.

## Verification

- Characterization tests: 177 passed after the pass.
- Related path-advisor + assemble-plan: 163 passed.
- `rtk npm run typecheck` exit 0 (pre-existing production-to-documentation/tooling only).
- `rtk npm run lint` exit 0 (`--max-warnings=0`).
- `openspec validate simplify-personalization-path-assembly --type change --strict` valid.
- No database, selector, or deployment change.

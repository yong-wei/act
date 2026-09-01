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

Agreed semantic inventory is `assemble-plan.ts` counts of types/interfaces, functions, `if (` guards, `validate*` functions, top-level imports, and duplicate conversion helpers (pairwise diversity builders + SAR node resolvers). Same file, same git baseline `a03e14aa3b`.

| Metric | Before | After | Delta |
| --- | --- | --- | --- |
| Module bytes | 489323 | 486779 | -2544 |
| Module LOC | 12794 | 12751 | -43 |
| `assemble-plan.ts` bytes | 250248 | 247704 | -2544 |
| `assemble-plan.ts` LOC | 6182 | 6139 | -43 |
| Types / interfaces (state variants) | 73 | 73 | 0 |
| Functions (semantic concepts) | 175 | 171 | -4 |
| Guards (`if (`) | 266 | 266 | 0 |
| Validators (`validate*`) | 6 | 6 | 0 |
| Dependencies (top-level imports) | 22 | 22 | 0 |
| Duplicate conversions: pairwise builders | 4 | 1 | -3 |
| Duplicate conversions: SAR resolvers | 2 | 1 | -1 |
| Public exports | unchanged | unchanged | 0 |
| Tests | 177 | 177 | 0 |

25% byte reduction not achieved. Production bytes declined; semantic concept inventory declined via functions and duplicate conversions. Guards, validators, and identity/privacy/terminal checks were not removed. Further catalog/factory compression would add wrappers without deleting a second authority, so it was skipped.

## Verification

- Characterization tests: 177 passed after the pass.
- Related path-advisor + assemble-plan: 163 passed.
- `rtk npm run typecheck` exit 0 (pre-existing production-to-documentation/tooling only).
- `rtk npm run lint` exit 0 (`--max-warnings=0`).
- `openspec validate simplify-personalization-path-assembly --type change --strict` valid.
- No database, selector, or deployment change.

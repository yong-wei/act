# Before/after metrics — simplify-personalization-path-assembly-pass-2

Baseline: `7a3430ddff` (`origin/integration` after #1953). Characterization tests unchanged: 177 passed.

## Pass

Identity / ranking / serialization reuse inside `assemble-plan.ts`:

- Collapse two current-node resolvers into `firstReadyCurrentNodeId`.
- Collapse six-way policy style if-chains into one `POLICY_FAMILY_STYLE` table.
- Collapse three explicit-preference source checks into `hasExplicitPlannerChoice`.
- Reuse remaining-minutes and terminal-validation node ids instead of recomputing them.

Did not split files. Did not add a planner, schema, or public export.

## Metrics

Agreed inventory is `assemble-plan.ts` counts, same as pass 1.

| Metric | Before | After | Delta |
| --- | --- | --- | --- |
| `assemble-plan.ts` bytes | 247704 | 247025 | -679 |
| `assemble-plan.ts` LOC | 6139 | 6126 | -13 |
| Functions | 171 | 170 | -1 |
| Guards (`if (`) | 266 | 255 | -11 |
| Validators (`validate*`) | 6 | 6 | 0 |
| Public exports | unchanged | unchanged | 0 |
| Characterization tests | 177 | 177 | 0 |

Production bytes, functions, and internal control-state guards all declined. No wrapper-only file split.

## Verification

- Characterization: 177 passed (`assemble-plan`, `plan-learning-path`, `prerequisite-planner`, `control-correction-real-seed-planner`).
- `git diff --check` clean.

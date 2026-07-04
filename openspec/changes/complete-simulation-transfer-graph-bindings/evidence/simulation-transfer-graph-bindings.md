# Simulation and Transfer Graph Resource Binding Evidence

Generated with:

```bash
rtk env RESOURCE_FIELD_COMPLETION_GENERATED_AT=2026-07-04T16:30:00.000Z npx tsx scripts/db/generate-resource-field-completion-audit.ts
```

## Reviewed Batch

- Batch id: `simulation-transfer-graph-resource-bindings-2026-07-04`
- Reviewer: `graph-resource-governance-review`
- Review role: `curriculum-data-governance`
- Reviewed source type: runtime lesson steps from current interactive manifests.
- Scope boundary: concept and citation path support for simulation-validation and ship-ocean transfer graph nodes only.

## Worklist Coverage

The reviewed worklist covers these high-complexity areas:

- Simulation validation and cross-model comparison: `4-7:step-03` through `4-7:step-10`
- Ship-ocean MASS transfer and responsibility boundaries: `5-3:step-09`, `5-3:step-10`, `5-3:step-11`, `5-3:step-12`, `5-3:step-13`, `5-3:step-15`

Excluded to preserve authority boundaries:

- `4-7:step-11` and `5-3:step-14` post-tests, because this batch does not approve checkpoint or assessment semantics.
- Simulation, workbench, and Arena preview resources as official or terminal validation evidence.
- Official Arena score, validity, ranking, leaderboard, and report authority, which remain sourced only from official Arena contracts.

## Reviewed Runtime Steps

The batch records these accepted runtime lesson steps:

- `4-7:step-03`
- `4-7:step-04`
- `4-7:step-05`
- `4-7:step-06`
- `4-7:step-07`
- `4-7:step-08`
- `4-7:step-09`
- `4-7:step-10`
- `5-3:step-09`
- `5-3:step-10`
- `5-3:step-11`
- `5-3:step-12`
- `5-3:step-13`
- `5-3:step-15`

## Before and After

Baseline before this change is the branch base artifacts after the analysis/design batch. Baseline after this change is the regenerated artifact set at `2026-07-04T16:30:00.000Z`.

| LearningGoal | Category | Before human/path | Before locked | After human/path | After locked |
| --- | --- | ---: | ---: | ---: | ---: |
| `simulation-validation-practice` | concept | 0 / 0 | 0 | 14 / 14 | 0 |
| `simulation-validation-practice` | citation | 0 / 0 | 11 | 14 / 14 | 11 |
| `simulation-validation-practice` | practice | 0 / 0 | 11 | 0 / 0 | 11 |
| `simulation-validation-practice` | terminal-validation | 0 / 0 | 9 | 0 / 0 | 9 |
| `ship-ocean-transfer-application` | concept | 0 / 0 | 0 | 14 / 14 | 0 |
| `ship-ocean-transfer-application` | citation | 0 / 0 | 12 | 14 / 14 | 12 |
| `ship-ocean-transfer-application` | practice | 0 / 0 | 12 | 0 / 0 | 12 |
| `ship-ocean-transfer-application` | terminal-validation | 0 / 0 | 12 | 0 / 0 | 12 |

## Helper Output

```text
Resource field completion audit rows: 5291
Resource completion workqueue items: 35011
Human review integrity issues: 0
Runtime resource projections: 3038
LearningGoal baseline reviewed bindings: 27
```

## Interpretation

- The two target LearningGoals now have reviewed concept and citation path support.
- Simulation, workbench, and Arena resources remain high-complexity locked for practice and terminal-validation until separate evidence-authority reviews approve those semantics.
- The batch does not create or infer official Arena results, score authority, leaderboard ranking, or terminal validation.

# Assessment Stage Baseline Shard Evidence

Change: `complete-assessment-stage-baseline-shards`

Generated evidence source:

- Coverage matrix: `course-content/runtime/resource-governance/learning-goal-assessment-coverage-matrix.json`
- Semantic review packets: `course-content/runtime/resource-governance/assessment-item-semantic-review-packets.jsonl`
- Semantic review snapshots: `course-content/runtime/resource-governance/assessment-item-semantic-review-snapshots.jsonl`
- Semantic review coverage: `course-content/runtime/resource-governance/assessment-item-semantic-review-coverage.json`
- Residual workqueue: `course-content/runtime/resource-governance/adaptive-assessment-item-catalog-limitations.json`

## Selected Shard

The selected shard is the deterministic assessment-stage baseline shard represented by the current coverage matrix:

- Selected LearningGoal rows: 9
- Selected LearningGoal/stage cells: 36
- Selected stages: readiness, practice, checkpoint, remediation
- Matrix generatedAt: `2026-07-03T22:37:19.780Z`
- Matrix version: `learning-goal-assessment-coverage.v1`

Selected item ids are recorded in
`learning-goal-assessment-coverage-matrix.json` at:

`rows[].stageCoverage[].countedCatalogItemIds`

The shard covers every selected cell at or above the stage requirement:

| Metric | Value |
| --- | ---: |
| LearningGoal rows | 9 |
| Complete rows | 9 |
| Limited rows | 0 |
| Reviewed path-eligible item count | 137 |
| Readiness items counted | 29 |
| Practice items counted | 54 |
| Checkpoint items counted | 27 |
| Remediation items counted | 27 |

## Item-by-item Review Evidence

Per-item semantic review is recorded in
`assessment-item-semantic-review-packets.jsonl` and
`assessment-item-semantic-review-snapshots.jsonl`.

The selected review packets preserve the source question, answer key, options,
rubric reference, explanation, candidate semantics, source hash, and the linked
review decision for each counted item.

The selected reviewed snapshots preserve the counted reviewer decision fields:

- `decisionKind: human-review`
- `outcome: approved`
- `catalogItemId`
- `sourceContentHash`
- `selectedLearningGoalIds`
- `selectedKaqObjectiveIds`
- `selectedGraphNodeIds`
- `selectedStagePurpose`
- `difficulty`
- `cognitiveLevel`
- `misconceptionRefs`
- `remediationRefs`
- `metadataVersionRefs`
- `reviewSourceHash`
- `notes` reviewer-visible rationale

Snapshot count by selected stage purpose:

| Stage purpose | Reviewed snapshots |
| --- | ---: |
| checkpoint | 27 |
| practice | 54 |
| precheck | 13 |
| readiness-gate | 16 |
| remediation | 27 |

Snapshot count by LearningGoal:

| LearningGoal | Reviewed snapshots |
| --- | ---: |
| control-correction | 16 |
| feedback-loop-concept-foundations | 15 |
| frequency-response-foundations | 15 |
| root-locus-analysis-foundations | 15 |
| ship-ocean-transfer-application | 15 |
| simulation-validation-practice | 15 |
| stability-margin-frequency-analysis | 15 |
| time-domain-response-analysis | 16 |
| transfer-function-modeling-foundations | 15 |

No selected snapshot is missing the required review fields listed above, and no
approved packet or snapshot is missing `notes`.

## Source-family Totals

Source-family totals are recorded in
`assessment-item-semantic-review-coverage.json`.

| Source family | Source total | Item total | Reviewed total | Path-eligible total | Unreviewed total |
| --- | ---: | ---: | ---: | ---: | ---: |
| acq-static-question | 167 | 167 | 0 | 0 | 167 |
| checkpoint-authored-question | 87 | 87 | 87 | 87 | 0 |
| generated-adaptive-question | 0 | 0 | 0 | 0 | 0 |
| icourse-objective-bank | 226 | 226 | 0 | 0 | 226 |
| kaq-foundation-reviewed | 50 | 0 | 0 | 0 | 0 |
| preset-adaptive-question | 50 | 50 | 50 | 50 | 0 |
| prisma-question | null | 0 | 0 | 0 | 0 |

The selected shard is satisfied by existing reviewed `preset-adaptive-question`
items plus reviewed `checkpoint-authored-question` items. No extra authoring is
needed for this closeout beyond the already-reviewed checkpoint-authored source
family present in the current integration baseline.

## Residual Unselected Counts

Residual unselected catalog rows remain in
`adaptive-assessment-item-catalog-limitations.json` and are not promoted by this
change.

| Residual reason | Count |
| --- | ---: |
| requires-path-eligibility-review | 226 |
| not-path-eligible | 167 |
| requires-semantic-review | 167 |
| missing-rubric | 126 |
| missing-solution | 2 |
| generated-questions-are-runtime-provisional-not-static-artifact | 1 |
| prisma-question-count-requires-database-query | 1 |

Residual counts by source family:

| Source family | Residual limitation rows |
| --- | ---: |
| acq-static-question | 462 |
| icourse-objective-bank | 226 |
| generated-adaptive-question | 1 |
| prisma-question | 1 |

## Before/After

Before this shard closeout, `proposal.md` recorded that assessment stages were
still limited for path-ready LearningGoals because reviewed path-eligible
diagnostic, practice, checkpoint, and remediation coverage was absent.

After this shard closeout:

- `learning-goal-assessment-coverage-matrix.json` reports 9 complete rows and 0 limited rows.
- Every selected LearningGoal/stage cell has counted reviewed path-eligible item ids.
- Residual unselected rows remain in the limitations workqueue rather than blocking unrelated fixture work.

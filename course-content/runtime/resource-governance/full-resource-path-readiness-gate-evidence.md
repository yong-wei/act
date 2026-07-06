# Full Resource Path Readiness Gate

Generated: 2026-07-04T16:30:00.000Z
Status: failed

## Resource Coverage

Total resources: 5291
Unaccounted resources: 0
Invalid path promotions: 273
Unreviewed semantic rows: 5239
Unresolved graph-node resource gaps: 3942
Unresolved downstream path blockers: 17713
Evidence-lineage blockers: 0
Yang Fan fixture blockers: 3124

## LearningGoal Diagnostics

Registered LearningGoals: 9
Diagnosed LearningGoals: 9
Missing diagnostics: none
Complete baselines: 0
Limited baselines: 9
Reviewed bindings: 27
Attempted path generations: 9
Blocked path generations: 9
Not evaluated path generations: 0
Missing path generation diagnostics: none
Unknown path generation diagnostics: none
Duplicate path generation diagnostics: 0
Resource mix not evaluated: 9
Citation metadata not evaluated: 9
Single-resource fallback risks: 0
Single-family fallback risks: 0
Citation failures: 0

### Gap Diagnostics

- control-correction: limited; missing diagnostic, practice, checkpoint, remediation, terminal-validation; reviewed bindings 3
- frequency-response-foundations: limited; missing diagnostic, practice, checkpoint, remediation; reviewed bindings 3
- feedback-loop-concept-foundations: limited; missing diagnostic, practice, checkpoint, remediation; reviewed bindings 3
- transfer-function-modeling-foundations: limited; missing diagnostic, practice, checkpoint, remediation; reviewed bindings 3
- time-domain-response-analysis: limited; missing diagnostic, practice, checkpoint, remediation; reviewed bindings 3
- root-locus-analysis-foundations: limited; missing diagnostic, practice, checkpoint, remediation; reviewed bindings 3
- stability-margin-frequency-analysis: limited; missing diagnostic, practice, checkpoint, remediation; reviewed bindings 3
- simulation-validation-practice: limited; missing diagnostic, practice, checkpoint, remediation, terminal-validation; reviewed bindings 3
- ship-ocean-transfer-application: limited; missing diagnostic, practice, checkpoint, remediation, terminal-validation; reviewed bindings 3

### Path Generation Attempts

- control-correction: blocked; fallback learning-goal-baseline-incomplete, terminal-validation-resource-missing, time-budget-insufficient; selected resources 0; selected types none
- frequency-response-foundations: blocked; fallback learning-goal-baseline-incomplete; selected resources 0; selected types none
- feedback-loop-concept-foundations: blocked; fallback learning-goal-baseline-incomplete; selected resources 0; selected types none
- transfer-function-modeling-foundations: blocked; fallback learning-goal-baseline-incomplete; selected resources 0; selected types none
- time-domain-response-analysis: blocked; fallback learning-goal-baseline-incomplete; selected resources 0; selected types none
- root-locus-analysis-foundations: blocked; fallback learning-goal-baseline-incomplete; selected resources 0; selected types none
- stability-margin-frequency-analysis: blocked; fallback learning-goal-baseline-incomplete; selected resources 0; selected types none
- simulation-validation-practice: blocked; fallback learning-goal-baseline-incomplete, terminal-validation-resource-missing, checkpoint-resource-missing; selected resources 0; selected types none
- ship-ocean-transfer-application: blocked; fallback learning-goal-baseline-incomplete, locked-node-without-fallback; selected resources 0; selected types none

## Future Import Coverage

Missing audited families: none
Missing audited resource types: adaptive_quiz, checkpoint, control_workbench, exercise, image-description, reference, transcript

## Findings

- [blocking] unresolved-downstream-path-blockers: 17713 - Reviewed disposition output still carries downstream path-readiness, runtime-identity, or dependency blockers.
- [blocking] invalid-path-promotion: 273 - Resources are marked path-current without complete human-reviewed governance.
- [blocking] unreviewed-resource-semantics: 5239 - Resources still require reviewed semantic fields or reviewed limitations.
- [blocking] unresolved-graph-node-resource-missing: 3942 - Resources still lack reviewed graph knowledge or capability bindings.
- [blocking] yang-fan-fixture-blockers: 3124 - Yang Fan fixture generation remains blocked by path-relevant lineage limitations.
- [blocking] learning-goal-path-generation-blocked: 9 - Registered LearningGoals attempted path generation but reported blocking planner reasons.
- [warning] learning-goal-baseline-limited: 9 - LearningGoals have precise resource-gap diagnostics instead of production path-ready baselines.
- [blocking] resource-type-audit-missing: 7 - Required future import resource types are not currently represented in helper output; future imports must not bypass this audit.

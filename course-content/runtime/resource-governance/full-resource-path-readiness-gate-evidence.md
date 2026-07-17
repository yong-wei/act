# Full Resource Path Readiness Gate

Generated: 2026-07-17T03:49:36.289Z
Status: failed

## Resource Coverage

Total resources: 5560
Unaccounted resources: 1049
Invalid path promotions: 7
Unreviewed semantic rows: 2440
Unresolved graph-node resource gaps: 4178
Unresolved downstream path blockers: 18756
Evidence-lineage blockers: 47
Yang Fan fixture blockers: 22
Yang Fan fixture global limitations: 1512

## LearningGoal Diagnostics

Registered LearningGoals: 9
Diagnosed LearningGoals: 9
Missing diagnostics: none
Complete baselines: 0
Limited baselines: 9
Reviewed bindings: 12
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
- feedback-loop-concept-foundations: limited; missing concept, diagnostic, practice, checkpoint, remediation; reviewed bindings 0
- transfer-function-modeling-foundations: limited; missing concept, diagnostic, practice, checkpoint, remediation; reviewed bindings 0
- time-domain-response-analysis: limited; missing concept, diagnostic, practice, checkpoint, remediation; reviewed bindings 0
- root-locus-analysis-foundations: limited; missing diagnostic, practice, checkpoint, remediation; reviewed bindings 3
- stability-margin-frequency-analysis: limited; missing diagnostic, practice, checkpoint, remediation; reviewed bindings 3
- simulation-validation-practice: limited; missing concept, diagnostic, practice, checkpoint, remediation, terminal-validation; reviewed bindings 0
- ship-ocean-transfer-application: limited; missing concept, diagnostic, practice, checkpoint, remediation, terminal-validation; reviewed bindings 0

### Path Generation Attempts

- control-correction: blocked; fallback resource-mapping-insufficient, learning-goal-baseline-incomplete, terminal-validation-resource-missing, checkpoint-resource-missing; selected resources 0; selected types none
- frequency-response-foundations: blocked; fallback resource-mapping-insufficient, learning-goal-baseline-incomplete, checkpoint-resource-missing; selected resources 0; selected types none
- feedback-loop-concept-foundations: blocked; fallback resource-mapping-insufficient, learning-goal-baseline-incomplete, checkpoint-resource-missing; selected resources 0; selected types none
- transfer-function-modeling-foundations: blocked; fallback resource-mapping-insufficient, learning-goal-baseline-incomplete, checkpoint-resource-missing; selected resources 0; selected types none
- time-domain-response-analysis: blocked; fallback resource-mapping-insufficient, learning-goal-baseline-incomplete, checkpoint-resource-missing; selected resources 0; selected types none
- root-locus-analysis-foundations: blocked; fallback resource-mapping-insufficient, learning-goal-baseline-incomplete, checkpoint-resource-missing; selected resources 0; selected types none
- stability-margin-frequency-analysis: blocked; fallback resource-mapping-insufficient, learning-goal-baseline-incomplete, checkpoint-resource-missing; selected resources 0; selected types none
- simulation-validation-practice: blocked; fallback resource-mapping-insufficient, learning-goal-baseline-incomplete, terminal-validation-resource-missing, checkpoint-resource-missing; selected resources 0; selected types none
- ship-ocean-transfer-application: blocked; fallback resource-mapping-insufficient, learning-goal-baseline-incomplete, terminal-validation-resource-missing, checkpoint-resource-missing; selected resources 0; selected types none

## Future Import Coverage

Missing audited families: none
Missing audited resource types: adaptive_quiz, checkpoint, control_workbench, exercise, image-description, reference, transcript

## Findings

- [blocking] unaccounted-resource-disposition: 1049 - Resources are missing a reviewed path-planning disposition.
- [blocking] unresolved-downstream-path-blockers: 18756 - Reviewed disposition output still carries downstream path-readiness, runtime-identity, or dependency blockers.
- [blocking] invalid-path-promotion: 7 - Resources are marked path-current without complete human-reviewed governance.
- [blocking] unreviewed-resource-semantics: 2440 - Resources still require reviewed semantic fields or reviewed limitations.
- [blocking] unresolved-graph-node-resource-missing: 4178 - Resources still lack reviewed graph knowledge or capability bindings.
- [blocking] evidence-lineage-blockers: 47 - Evidence-producing path resources still have hard evidence-lineage blockers.
- [blocking] yang-fan-fixture-blockers: 22 - Yang Fan fixture generation remains blocked by fixture-owned lineage limitations.
- [warning] yang-fan-fixture-limited-coverage: 1512 - Yang Fan fixture-owned resources are scoped separately; unrelated global resource backlog remains visible as limited coverage.
- [blocking] learning-goal-path-generation-blocked: 9 - Registered LearningGoals attempted path generation but reported blocking planner reasons.
- [warning] learning-goal-baseline-limited: 9 - LearningGoals have precise resource-gap diagnostics instead of production path-ready baselines.
- [blocking] resource-type-audit-missing: 7 - Required future import resource types are not currently represented in helper output; future imports must not bypass this audit.

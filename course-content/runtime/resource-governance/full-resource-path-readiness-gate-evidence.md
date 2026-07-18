# Full Resource Path Readiness Gate

Generated: 2026-07-18T05:00:00.000Z
Status: passed

## Resource Coverage

Total resources: 6509
Unaccounted resources: 0
Invalid path promotions: 0
Unreviewed semantic rows: 0
Unresolved graph-node resource gaps: 0
Unresolved downstream path blockers: 0
Evidence-lineage blockers: 0
Yang Fan fixture blockers: 0
Yang Fan fixture global limitations: 1512

## LearningGoal Diagnostics

Registered LearningGoals: 9
Diagnosed LearningGoals: 9
Missing diagnostics: none
Complete baselines: 0
Limited baselines: 9
Reviewed bindings: 17
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

- control-correction: limited; missing diagnostic, checkpoint, remediation; reviewed bindings 5
- frequency-response-foundations: limited; missing diagnostic, practice, checkpoint, remediation; reviewed bindings 3
- feedback-loop-concept-foundations: limited; missing concept, diagnostic, practice, checkpoint, remediation; reviewed bindings 0
- transfer-function-modeling-foundations: limited; missing concept, diagnostic, practice, checkpoint, remediation; reviewed bindings 0
- time-domain-response-analysis: limited; missing concept, diagnostic, practice, checkpoint, remediation; reviewed bindings 0
- root-locus-analysis-foundations: limited; missing diagnostic, practice, checkpoint, remediation; reviewed bindings 3
- stability-margin-frequency-analysis: limited; missing diagnostic, practice, checkpoint, remediation; reviewed bindings 3
- simulation-validation-practice: limited; missing concept, diagnostic, practice, checkpoint, remediation, terminal-validation; reviewed bindings 0
- ship-ocean-transfer-application: limited; missing concept, diagnostic, checkpoint, remediation; reviewed bindings 3

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

- [warning] yang-fan-fixture-limited-coverage: 1512 - Yang Fan fixture-owned resources are scoped separately; unrelated global resource backlog remains visible as limited coverage.
- [warning] learning-goal-path-generation-reviewed-blockers: 9 - Registered LearningGoals report specific reviewed blockers and do not expose cosmetic path options.
- [warning] learning-goal-baseline-limited: 9 - LearningGoals have precise resource-gap diagnostics instead of production path-ready baselines.
- [warning] resource-type-audit-missing: 7 - Required future import resource types are not currently represented; the new-resource gate remains responsible for rejecting incomplete future instances.

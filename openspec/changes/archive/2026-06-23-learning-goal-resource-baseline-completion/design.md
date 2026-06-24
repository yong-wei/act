## Overview

This is the first large-scale field completion change. It should not attempt to make every content file path-ready. It completes enough reviewed resources to make the first batch of current path-ready LearningGoals usable and records explicit limitations for goals that cannot yet meet the baseline.

## Batch Scope

The first implementation batch SHALL cover the current catalog ids that are already path-ready in code at implementation time, capped to the first nine catalog goals unless a later proposal narrows the list:

- `control-correction`;
- `frequency-response-foundations`;
- `feedback-loop-concept-foundations`;
- `transfer-function-modeling-foundations`;
- `time-domain-response-analysis`;
- `root-locus-analysis-foundations`;
- `stability-margin-frequency-analysis`;
- `simulation-validation-practice`;
- `ship-ocean-transfer-application`.

If a listed LearningGoal cannot meet baseline coverage in this change, the implementation must emit a low-resource limitation record rather than expanding scope.

## Baseline Resource Mix

Each in-scope path-ready LearningGoal should have at minimum:

- two concept resources: knowledge card, textbook section, lesson step, or handout;
- one diagnostic quiz or adaptive quiz;
- one practice resource: quiz, interaction, worksheet, simulation preview, or control workbench task;
- one checkpoint or post-check resource;
- one remediation or reflection resource;
- terminal validation resource only when required by the LearningGoal policy.

## Human Review Boundary

The following fields must be human-confirmed before path eligibility:

- LearningGoal ids;
- K/A/Q objective ids;
- knowledge node ids;
- capability and quality target ids;
- ability impact weights;
- readiness thresholds;
- terminal validation policy;
- mastery-affecting quiz mappings.

Path-eligible baseline resources must also carry complete evidence contracts and review audit fields from `resource-field-completion-audit`.

Local model suggestions may accelerate summaries, candidate mappings, and unbound image semantics, but must remain provisional until reviewed.

## High-Complexity Gate

Simulation, Arena, control workbench validation, project, and terminal checkpoint nodes must declare readiness. Students below readiness can see the node only as locked future context with fallback resources.

## Coverage Output

Coverage must be reported by LearningGoal and by K/A/Q objective:

- linked resources;
- human-confirmed resources;
- path-eligible resources;
- citation-ready resources;
- assessment resources;
- checkpoint resources;
- high-complexity locked resources;
- missing baseline categories.

Coverage output must include denominator, source window, resource projection version, graph and goal version refs, limitation reason, and whether the payload is student-safe, teacher-diagnostic, or administrator-diagnostic.

## Artifact Paths

The implementation SHALL write baseline completion artifacts under `course-content/runtime/resource-governance/`:

- `learning-goal-resource-baseline-matrix.json` for the first-batch LearningGoal x resource-category coverage matrix;
- `learning-goal-resource-baseline-limitations.json` for low-resource goals, blocked high-complexity resources, missing categories, and student-safe limitation reasons;
- `learning-goal-resource-baseline-reviewed-bindings.jsonl` for human-confirmed resource bindings and audit refs.

## Validation

The change is complete when every in-scope LearningGoal either has a baseline path-ready mix or an explicit low-resource limitation that blocks production path generation for that goal.

## Why

Adaptive assessment already has durable persistence and basic question generation, but the current question set does not systematically cover LearningGoals, K/A/Q objectives, capability targets, misconception tags, readiness gates, and remediation links. Path planning needs a governed quiz foundation bank before tests can reliably diagnose readiness or unlock heavier resources.

## What Changes

- Define a K/A/Q-aligned quiz foundation bank for path-ready LearningGoals.
- Add required metadata for every question, quiz set, diagnostic, practice, checkpoint, and readiness gate.
- Preserve generated-question capability, but require curated or reviewed metadata before questions affect mastery, readiness, or path completion.
- Link quiz outcomes to ResourceNode readiness, learner evidence, remediation resources, and LearningGoal coverage.

## Capabilities

### Modified Capabilities

- `adaptive-assessment-persistence`: persist and restore K/A/Q-aligned question metadata and outcome refs.
- `adaptive-learning-path-planning`: consume quiz coverage and readiness evidence for path generation.

## Impact

- Depends on `resource-field-completion-audit`.
- Depends on `learning-goal-resource-baseline-completion` for the first-batch LearningGoal list and baseline coverage matrix.
- Affects adaptive question bank, generated question metadata, persistence, path execution evidence, and planner readiness gates.

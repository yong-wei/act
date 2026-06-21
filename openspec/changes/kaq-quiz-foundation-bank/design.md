## Overview

This change creates the foundational quiz layer required for path planning. It does not replace generated questions; it defines what metadata a question needs before it can influence path readiness or mastery.

## Batch Scope

The first implementation batch SHALL use the same in-scope path-ready LearningGoals and baseline category matrix as `learning-goal-resource-baseline-completion`. If a LearningGoal lacks enough reviewed quiz coverage, the implementation must emit a coverage limitation instead of letting generated-only questions satisfy diagnostic, checkpoint, readiness, or terminal validation requirements.

## Quiz Metadata

Each curated or reviewed question must declare:

- question id and immutable content hash;
- LearningGoal ids;
- K/A/Q objective ids;
- knowledge node ids;
- capability and quality target ids;
- difficulty;
- Bloom or cognitive level;
- question type;
- diagnostic purpose;
- misconception tags;
- evidence outcome refs;
- scoring or rubric metadata;
- remediation ResourceNode ids;
- review state and version.

Each reviewed question must also preserve review audit fields from `resource-field-completion-audit`: reviewer id or role, review timestamp, review batch id, source hash, metadata version ref, and any generation tool/model/prompt/version used before review.

## Quiz Set Coverage

Each path-ready LearningGoal should have:

- a precheck set for prerequisite and misconception detection;
- practice items for each key objective;
- a postcheck or checkpoint set;
- readiness-gate items for high-complexity resources where needed.

## Generated Questions

Generated questions may be created for practice variety, but their metadata is provisional until reviewed. Provisional generated questions may support low-stakes practice but cannot unlock heavy nodes, satisfy terminal validation, or update high-confidence mastery.

## Evidence Integration

Quiz submissions must produce outcome refs that can be used by learner overlays, path readiness gates, checkpoints, and remediation selection without exposing raw answer bodies in ordinary learner-state payloads.

Every finalized quiz outcome must materialize a governed evidence record with:

- question snapshot id and immutable content hash;
- quiz set id, attempt id, session id where available, and attempt key;
- scoring version, rubric version where applicable, denominator, raw score, normalized score, and retry policy;
- event source, event type, client event id where available, source log id, dedupe key, started/submitted/graded timestamps;
- LearningGoal, K/A/Q objective, graph, capability, quality, misconception, outcome, and remediation refs;
- confidence and whether the result may affect LearningFact, StudentCompetencySnapshot, readiness gates, terminal validation, or only low-stakes practice history.

Generated or under-reviewed evidence must degrade confidence and must not update high-confidence mastery, unlock high-complexity resources, or satisfy terminal validation.

## Artifact Paths

The implementation SHALL write quiz bank artifacts under `course-content/runtime/resource-governance/`:

- `kaq-quiz-foundation-coverage-matrix.json` for LearningGoal/objective quiz coverage;
- `kaq-quiz-foundation-reviewed-items.jsonl` for reviewed question metadata snapshots and audit refs;
- `kaq-quiz-foundation-limitations.json` for generated-only coverage, missing review audit, evidence contract gaps, and blocked readiness gates.

## Validation

The quiz bank is complete when each current path-ready LearningGoal has enough reviewed questions to support baseline diagnosis and checkpoints, and generated-only coverage is reported as a limitation.

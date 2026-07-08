## Semantic Review Protocol

The implementing agent must inspect each question or assessment item. For each item, assign graph/K/A/Q refs, LearningGoal fit, stage role, difficulty, cognitive level, misconception/remediation refs, evidence behavior, scoring status, source/version evidence, and review rationale. A `needs-human-review` marker means the agent performs this semantic review and an independent reviewer verifies it.

Scripts may identify gaps, list items, and verify stage coverage. Scripts must not auto-accept item semantics.

## Stage Coverage

For each path-ready LearningGoal, the batch should produce or confirm reviewed resources for:

- diagnostic/precheck
- practice
- checkpoint
- remediation
- terminal validation when the LearningGoal policy requires it

If existing resources cannot support a stage, the implementation may create the minimal number of new reviewed items needed for that stage, with source/rationale and evidence contract.

## Evidence Boundary

Items with incomplete scoring, lineage, or source metadata may remain visible as practice or supporting material only if their limitations are reviewed. They must not affect mastery, checkpoint completion, or terminal validation until evidence contracts are complete.

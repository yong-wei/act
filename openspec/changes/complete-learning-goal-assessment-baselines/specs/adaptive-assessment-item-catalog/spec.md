## ADDED Requirements
### Requirement: LearningGoal assessment baselines are completed in reviewed batches
Every current path-ready LearningGoal SHALL have a reviewed minimum assessment baseline before adaptive runtime selection can rely on catalog items.

#### Scenario: Baseline batch is reviewed
- **WHEN** assessment coverage is generated for the current LearningGoal registry
- **THEN** each LearningGoal SHALL report reviewed path-eligible diagnostic, practice, checkpoint, remediation, and terminal-validation where required items or precise limitation states
- **AND** counted items SHALL include current human semantic review, source hash, LearningGoal id, K/A/Q objective ids, graph-node refs, stage purpose, difficulty, cognitive level, misconception or remediation refs where applicable, and version metadata.

#### Scenario: Existing items are insufficient
- **WHEN** existing preset, Prisma, AC-Q, iCourse, generated, or K/A/Q foundation items cannot satisfy a required stage after review
- **THEN** the catalog SHALL expose the gap for manual authoring
- **AND** generated or unreviewed items SHALL NOT count as readiness, checkpoint, remediation, or terminal-validation coverage.

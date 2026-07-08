## ADDED Requirements

### Requirement: Assessment items have reviewed LearningGoal stage semantics
Assessment, quiz, exercise, homework-derived, adaptive practice, checkpoint, remediation, and terminal-validation items SHALL have reviewed semantics before they can support adaptive paths.

#### Scenario: Assessment item is reviewed
- **WHEN** an assessment item is used for path diagnostics, practice, checkpoint, remediation, or terminal validation
- **THEN** it SHALL include reviewed graph refs, LearningGoal fit, K/A/Q objective refs, stage role, difficulty, cognitive level, misconception or remediation mapping where applicable, evidence behavior, scoring status, source/version evidence, and review metadata
- **AND** generated suggestions or unreviewed placeholders SHALL NOT satisfy completion.

#### Scenario: LearningGoal stage coverage is checked
- **WHEN** the assessment coverage gate runs for path-ready LearningGoals
- **THEN** each LearningGoal SHALL report reviewed diagnostic, practice, checkpoint, remediation, and required terminal-validation resources or a concrete blocker
- **AND** missing stages SHALL not be hidden by generic content resources.

#### Scenario: Item lacks evidence authority
- **WHEN** an item lacks scoring, source lineage, or evidence contract required for mastery effects
- **THEN** it SHALL not affect mastery, checkpoint completion, remediation success, or terminal validation
- **AND** it MAY remain as limited practice only with reviewed limitation metadata.

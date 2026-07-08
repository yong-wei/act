## ADDED Requirements

### Requirement: Assessment resources declare governed path roles
Assessment resources SHALL declare reviewed path roles before entering ResourceNode path planning.

#### Scenario: Assessment resource becomes a checkpoint
- **WHEN** a quiz, exercise, adaptive practice item, or generated checkpoint is promoted to a path checkpoint or remediation node
- **THEN** the ResourceNode metadata SHALL include LearningGoal stage role, graph/K/A/Q refs, evidence contract, scoring authority, remediation behavior, privacy policy, route target, and review metadata.

#### Scenario: Assessment resource is only practice support
- **WHEN** an item is useful for practice but lacks governed evidence authority
- **THEN** it SHALL be classified with limited practice or supporting disposition
- **AND** it SHALL NOT satisfy checkpoint, remediation, mastery, or terminal-validation requirements.

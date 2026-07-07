## ADDED Requirements

### Requirement: Path planning respects LearningGoal assessment coverage completeness
The adaptive path planner SHALL consume LearningGoal assessment coverage state before treating a path as fully personalized, checkpoint-backed, or high-confidence.

#### Scenario: Complete assessment coverage exists
- **WHEN** a learner requests a path for a LearningGoal with complete reviewed assessment item coverage
- **THEN** the planner MAY include precheck, practice, checkpoint, readiness, and remediation assessment nodes according to policy
- **AND** the generated path SHALL cite the coverage matrix version used for those assessment nodes.

#### Scenario: Assessment coverage is incomplete
- **WHEN** a learner requests a path for a LearningGoal whose reviewed item coverage is incomplete
- **THEN** the planner SHALL expose a coverage limitation or block high-confidence personalization according to policy
- **AND** it SHALL NOT fabricate checkpoint coverage from generated, template, unreviewed, or deprecated items.

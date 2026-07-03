## ADDED Requirements

### Requirement: Planner can select completed core resource types
The adaptive path planner SHALL be able to select reviewed core teaching resources for registered LearningGoals when those resources pass ResourceNode audit.

#### Scenario: Registered LearningGoal has reviewed core resources
- **WHEN** a student requests a path for a registered LearningGoal whose core resources have reviewed path readiness
- **THEN** the planner SHALL consider interactive lessons, knowledge cards, quizzes, simulations, exercises, and other reviewed core resource types according to goal policy and learner state
- **AND** it SHALL expose selected and rejected resource reasons without relying on hard-coded goal names.

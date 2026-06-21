## MODIFIED Requirements

### Requirement: Adaptive goals are registered before use
Goal slices SHALL remain the canonical internal scope bridge for adaptive learning features and SHALL be compatible with first-class LearningGoals.

#### Scenario: LearningGoal references a goal slice
- **WHEN** a LearningGoal declares a goal slice id
- **THEN** the goal slice registry SHALL resolve the slice and expose its canonical scope metadata
- **AND** LearningGoal validation SHALL fail or mark the LearningGoal as not `path-ready` when the referenced slice is missing or inactive.

#### Scenario: Goal slice is exposed to students
- **WHEN** student-facing path or assistant output describes the target
- **THEN** the output SHALL use the LearningGoal title and completion meaning
- **AND** it SHALL NOT present the goal slice as the student-facing goal package or parent target.

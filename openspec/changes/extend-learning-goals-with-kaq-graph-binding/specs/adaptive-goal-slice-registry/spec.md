## MODIFIED Requirements

### Requirement: Goal slices preserve canonical adaptive-learning scope
Goal slices SHALL remain the canonical scope bridge for adaptive learning features and SHALL be compatible with LearningGoal packages.

#### Scenario: LearningGoal package references a goal slice
- **WHEN** a LearningGoal package declares a goal slice id
- **THEN** the goal slice registry SHALL resolve the slice and expose its canonical scope metadata
- **AND** package validation SHALL fail or mark the package as not `path-ready` when the referenced slice is missing or inactive.

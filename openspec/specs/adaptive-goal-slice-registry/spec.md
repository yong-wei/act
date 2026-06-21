# adaptive-goal-slice-registry Specification

## Purpose
Define the governed registry that adaptive learner-state consumers use to resolve goal-specific slices before personalization, path planning, reporting, grading writeback, or Konling runtime consumption.
## Requirements
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

### Requirement: Goal slices declare field contracts
Every adaptive goal slice SHALL declare machine-readable contracts for its dimension fields.

#### Scenario: Goal dimension is declared
- **WHEN** a goal dimension is added
- **THEN** it SHALL declare value range, target level mapping, source families, evidence threshold, freshness policy, confidence policy, privacy visibility, and fallback reason.

#### Scenario: Goal dimension is undeclared
- **WHEN** implementation emits a dimension that is absent from the registered goal contract
- **THEN** validation SHALL fail before the dimension is used for personalization, path planning, reporting, or grading writeback.

### Requirement: Goal slices expose knowledge capability targets
Registered adaptive goals SHALL be able to declare capability targets on knowledge graph nodes without changing the factual knowledge node definition.

#### Scenario: Capability target is registered
- **WHEN** a goal slice declares a capability target
- **THEN** it SHALL include knowledge node reference, capability level, behavior verb, success criteria, observable evidence type, and evaluation method
- **AND** the target SHALL map to existing competency dimensions or learner-state feature groups where applicable.

#### Scenario: Knowledge relation informs path planning
- **WHEN** a capability target references prerequisite knowledge relations
- **THEN** those relations SHALL be treated as disciplinary prerequisites
- **AND** path strategy edges such as remedial, alternative, extension, or fallback SHALL remain separate planning metadata.


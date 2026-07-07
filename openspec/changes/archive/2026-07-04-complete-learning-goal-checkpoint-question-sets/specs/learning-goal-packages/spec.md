## ADDED Requirements

### Requirement: LearningGoals expose assessment checkpoint coverage state
Path-ready LearningGoals SHALL expose whether their reviewed assessment item coverage is sufficient for precheck, practice, checkpoint, remediation, and terminal-validation support.

#### Scenario: LearningGoal catalog is validated
- **WHEN** the current first-batch path-ready LearningGoal catalog is validated
- **THEN** each LearningGoal SHALL expose assessment coverage state by required stage
- **AND** incomplete stages SHALL be visible as blocker or limitation metadata rather than hidden from the student-facing catalog.

#### Scenario: Terminal-validation goal is assessed
- **WHEN** a LearningGoal requires simulation, control workbench, Arena, project, or other typed terminal evidence
- **THEN** assessment items MAY support readiness or checkpoint diagnosis
- **AND** they SHALL NOT replace the typed terminal-validation outcome required by the LearningGoal policy.

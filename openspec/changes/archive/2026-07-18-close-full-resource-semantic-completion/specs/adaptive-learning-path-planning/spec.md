## ADDED Requirements

### Requirement: All path-ready LearningGoals prove governed resource coverage
Adaptive path diagnostics SHALL prove that each path-ready LearningGoal can generate meaningful governed paths after resource semantic completion.

#### Scenario: Goal has governed resource coverage
- **WHEN** all resource-completion batches are closed
- **THEN** each registered path-ready LearningGoal SHALL generate path options from reviewed ResourceNodes, checkpoints, and supporting citations according to its K/A/Q boundary
- **AND** path options SHALL expose resource mix, overlap, effort, stage coverage, and limitation metadata.

#### Scenario: Goal still has a reviewed blocker
- **WHEN** a LearningGoal cannot generate meaningful governed paths after closure
- **THEN** diagnostics SHALL identify a specific reviewed blocker such as missing source artifact, unresolved route, missing terminal-validation authority, or unavailable evidence lineage
- **AND** the student-facing surface SHALL not show cosmetic identical path options.

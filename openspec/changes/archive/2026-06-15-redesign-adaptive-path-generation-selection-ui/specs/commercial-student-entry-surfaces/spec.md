## ADDED Requirements

### Requirement: Adaptive learning entry is a path-center surface
The adaptive learning entry SHALL present learning path generation, selection, and practice access as one student journey.

#### Scenario: Student enters adaptive learning
- **WHEN** a student opens adaptive learning from homepage, cockpit, profile, or another entry
- **THEN** the first viewport SHALL show path-generation intent, current learning work, and available next action
- **AND** it SHALL not appear as a fixed-width control-correction diagnostics page.

#### Scenario: Adaptive practice intent is preserved
- **WHEN** a student enters with practice intent
- **THEN** adaptive quiz access SHALL remain available as a path resource or current node
- **AND** path generation SHALL not hide or remove the user's practice task.

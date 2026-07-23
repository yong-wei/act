## ADDED Requirements

### Requirement: Arena Odyssey launches bind to a designated level
The system SHALL resolve each Arena Control Odyssey task to exactly one configured Odyssey level and SHALL carry that assignment through workspace entry and score submission.

#### Scenario: Assigned task opens its configured level
- **WHEN** a student opens an Arena task configured for Control Odyssey
- **THEN** the workspace URL MUST identify the task's configured Odyssey level
- **AND** the game MUST use that level for the resulting run.

#### Scenario: Task has no configured Odyssey assignment
- **WHEN** an Arena Control Odyssey task has no configured assigned level
- **THEN** the system MUST NOT manufacture a level assignment
- **AND** it MUST NOT create an official Arena submission from an unassigned run.

### Requirement: Arena-assigned sessions restrict level navigation
The system SHALL treat a valid Arena-assigned Odyssey session as a single-level workspace rather than ordinary free play.

#### Scenario: Assigned session starts directly in configuration
- **WHEN** a student enters Odyssey with a valid Arena task assignment
- **THEN** the game MUST open the assigned level's configuration view
- **AND** it MUST NOT expose the introduction or level-selection view.

#### Scenario: Assigned session cannot move to another level
- **WHEN** an Arena-assigned session is active
- **THEN** return-to-menu and next-level actions MUST keep the student in the assigned level's configuration or retry flow
- **AND** the student MUST NOT select a different Odyssey level.

### Requirement: Assigned sessions provide temporary locked-level access
The system SHALL permit an Arena-assigned session to run its configured level even if ordinary Odyssey progression has not unlocked that level.

#### Scenario: Normally locked assigned level
- **WHEN** an Arena task is assigned to a level that is locked in the student's ordinary Odyssey profile
- **THEN** the student MUST be able to configure and run that level through the Arena workspace
- **AND** the ordinary level list MUST remain locked outside that Arena session.

### Requirement: Temporary access does not advance ordinary Odyssey progression
The system SHALL isolate valid Arena-assigned runs from ordinary Odyssey rewards and unlock progression.

#### Scenario: Completing an assigned locked level
- **WHEN** a student completes a valid Arena-assigned Odyssey run
- **THEN** the system MUST retain the simulation log and create the eligible Arena evaluation submission
- **AND** it MUST NOT increment ordinary Odyssey credits, update tier progress, or unlock a subsequent ordinary level.

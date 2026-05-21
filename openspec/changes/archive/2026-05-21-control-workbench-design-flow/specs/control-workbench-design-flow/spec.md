## ADDED Requirements

### Requirement: Workbench sessions expose a design flow
The system SHALL derive a student-facing design flow for each workbench session.

#### Scenario: Arena challenge session is resolved
- **WHEN** a workbench session is created for an Arena challenge
- **THEN** it includes ordered design steps appropriate to the challenge preset and mode

### Requirement: Workbench shell shows current design context
The system SHALL display the current task, object, method boundary, and next design action in the unified workbench shell.

#### Scenario: Student enters the workbench
- **WHEN** the workbench shell renders
- **THEN** the student can identify whether they are in challenge, assignment, explore, or review mode and which design step is active

### Requirement: Advanced panel controls remain available
The system SHALL preserve existing workbench panel configuration behavior after adding the design flow.

#### Scenario: Student customizes panels
- **WHEN** the student adds, removes, or resets a panel
- **THEN** the behavior remains compatible with existing allowed view rules

## ADDED Requirements

### Requirement: Learner state links to active control-correction path rounds
The system SHALL expose privacy-safe references from learner state to active or recent control-correction path rounds when authorized.

#### Scenario: Active path exists
- **WHEN** learner state is requested for `goal=control-correction` and an active path exists for the student
- **THEN** the learner-state payload SHALL include the active path id, status, current node, terminal validation state, and low-confidence markers needed by downstream consumers
- **AND** it SHALL NOT embed raw execution payloads or private Konling dialogue.

#### Scenario: No active path exists
- **WHEN** no active control-correction path exists
- **THEN** learner state SHALL expose an explicit no-active-path state
- **AND** path planning consumers SHALL be able to distinguish that state from a failed learner-state read.

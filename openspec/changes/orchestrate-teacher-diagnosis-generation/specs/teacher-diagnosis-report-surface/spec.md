## MODIFIED Requirements

### Requirement: Teachers can revisit governed diagnosis report history

The system SHALL show persisted diagnosis reports inside the existing teacher class and class-bound student workspaces. The history SHALL be newest first and SHALL preserve class or student scope. The surface SHALL expose a generation control and task status, while persisted report entries SHALL remain immutable and selecting or refreshing history SHALL NOT trigger generation.

#### Scenario: Teacher generates from report history

- **WHEN** an authenticated teacher requests a diagnosis from an authorized class or student report surface
- **THEN** the surface SHALL display the durable task state until it reaches a terminal outcome
- **AND** successful completion SHALL refresh the persisted report history.

#### Scenario: Teacher only views history

- **WHEN** a teacher selects or refreshes an existing report entry
- **THEN** the surface SHALL display the persisted snapshot
- **AND** SHALL NOT create or enqueue a generation job.


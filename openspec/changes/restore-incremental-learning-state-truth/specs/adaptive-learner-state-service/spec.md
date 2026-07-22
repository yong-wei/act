## MODIFIED Requirements

### Requirement: Learner portrait updates are stable and incremental

The learner portrait update engine SHALL use the existing LearningFact cursor to apply newly mapped state-changing evidence without replacing established learner state merely because a scheduler runs or evidence has aged.

#### Scenario: A state-changing fact is ingested

- **WHEN** an ingestion batch persists a LearningFact with a mapped state-changing contribution
- **THEN** it SHALL schedule that learner's existing snapshot worker without waiting for the active-student coordinator
- **AND** the worker SHALL update only the dimensions affected by the new evidence.

#### Scenario: Context-only or duplicate input is processed

- **WHEN** an ingestion batch contains only context-only, unmapped, or duplicate facts for a learner
- **THEN** the portrait materializer SHALL report no state write
- **AND** the worker SHALL NOT append a learner snapshot or dependent class, risk, summary, cache, growth, or outbox state.

#### Scenario: No new state-changing evidence is available

- **WHEN** a learner has an existing state and a scheduled scan finds no new mapped state-changing fact
- **THEN** the existing learner state SHALL remain effective
- **AND** the scan SHALL NOT append a no-recent-evidence or empty replacement solely because a rolling window is empty.

#### Scenario: A later state-changing fact follows context-only input

- **WHEN** context-only input precedes a later mapped state-changing fact
- **THEN** the later fact SHALL produce one incremental update
- **AND** retry or duplicate scheduling SHALL NOT produce additional state updates.

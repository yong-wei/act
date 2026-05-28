## ADDED Requirements

### Requirement: Existing interactive lessons are fully migrated
The system SHALL track every existing runtime-first interactive lesson as migrated to the standard module framework before legacy aliases are removed.

#### Scenario: Full inventory is covered
- **WHEN** the final strict gate runs
- **THEN** the migrated inventory SHALL include all existing runtime-first interactive lessons
- **AND** any missing lesson SHALL fail the gate.

#### Scenario: All migrated lessons pass strict validation
- **WHEN** a migrated lesson is in the inventory
- **THEN** it SHALL pass canonical module, canonical response, submission evidence, and finalization gates
- **AND** it SHALL NOT require a lesson-private module-kind exception.

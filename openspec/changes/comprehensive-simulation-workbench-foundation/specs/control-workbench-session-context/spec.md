## ADDED Requirements

### Requirement: Free explore session carries selected model context
The unified control workbench SHALL provide free-explore sessions with a selected object and nominal working model when a compatible white-box object is available.

#### Scenario: Free explore uses default white-box object
- **WHEN** a student opens `/interactive-learning/control-workbench?mode=explore&preset=classic-four-view` without an `arenaTask`
- **THEN** the resolved session SHALL remain in explore mode
- **AND** it SHALL include a selected object from the configured object catalog
- **AND** it SHALL include a transfer-function working model for the selected object
- **AND** official evaluation and leaderboard eligibility SHALL remain disabled.

#### Scenario: Free explore object id selects configured object
- **WHEN** a student opens `/interactive-learning/control-workbench?mode=explore&preset=classic-four-view&objectId=plant-first-order-lag`
- **THEN** the resolved session SHALL use `plant-first-order-lag` as the selected object
- **AND** its working model SHALL use that object's transfer-function representation.

#### Scenario: Invalid free explore object falls back safely
- **WHEN** a student opens free explore with an unknown `objectId`
- **THEN** the resolved session SHALL fall back to the default free-explore object
- **AND** it SHALL NOT expose official challenge state.

## ADDED Requirements

### Requirement: Arena preview runs map to canonical SimulationRun
Arena virtual simulation preview SHALL retain its Arena-specific detail record while mapping each new preview run to a canonical SimulationRun.

#### Scenario: Preview run is created
- **WHEN** a student creates an Arena virtual simulation preview from an owned black-box experiment and registered identification model
- **THEN** the system SHALL create or resolve a canonical SimulationRun with `runKind` of `arena_preview`
- **AND** the Arena preview detail record SHALL store the canonical SimulationRun reference.

#### Scenario: Preview detail is rendered
- **WHEN** an Arena page needs dataset, registered model, controller hash, or preview trace detail
- **THEN** it MAY read the Arena preview detail record
- **AND** it SHALL preserve the canonical SimulationRun reference in returned metadata.

### Requirement: Arena preview remains separate from official evaluation
Arena preview SHALL remain visibly and semantically separate from official submissions and leaderboard evaluation.

#### Scenario: Official submission is evaluated
- **WHEN** an official Arena submission is evaluated
- **THEN** the system SHALL NOT use Arena preview run score or summary as the official leaderboard score
- **AND** it SHALL preserve the official evaluation protocol as the authoritative source for official results.

#### Scenario: Preview metadata is returned
- **WHEN** a preview run is returned to Konling, evidence, profile, teacher, or data-center consumers
- **THEN** the metadata SHALL identify preview visibility, official ineligibility, model relation, dataset hash, controller hash, identification model, and source experiment where available.

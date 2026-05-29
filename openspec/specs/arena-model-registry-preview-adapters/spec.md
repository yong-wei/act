## Purpose

Define the Arena model registry and adapter support contract that governs black-box public experiment datasets, virtual simulation previews, and official evaluations.
## Requirements
### Requirement: Arena identified models are server registered
The system SHALL create or resolve server-owned registered model artifacts for black-box identification models derived from persisted public experiment datasets.

#### Scenario: Dataset produces registered model
- **WHEN** a student creates an identification model from an owned black-box experiment dataset
- **THEN** the system SHALL return a registered model id tied to the source experiment and dataset hash

#### Scenario: Client submits arbitrary model id
- **WHEN** a client attempts to run preview or submission with an unregistered or mismatched model id
- **THEN** the system SHALL reject the request before running simulation or evaluation

### Requirement: Arena adapter support is explicit
The system SHALL expose explicit adapter support for public experiments, virtual previews, and official evaluations.

#### Scenario: Adapter does not support a mode
- **WHEN** an Arena task requests an unsupported adapter mode
- **THEN** the system SHALL return an explicit unsupported reason instead of silently falling back to a mock or incompatible path

### Requirement: Preview remains separate from official evaluation
The system SHALL keep virtual preview traces and visible preview metrics separate from official hidden evaluation and leaderboard scoring.

#### Scenario: Preview run exists
- **WHEN** an official submission is evaluated
- **THEN** the official evaluation SHALL NOT use preview results as leaderboard score inputs

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


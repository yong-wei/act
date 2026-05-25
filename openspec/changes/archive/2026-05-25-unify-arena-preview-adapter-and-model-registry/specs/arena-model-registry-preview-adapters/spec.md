## ADDED Requirements

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

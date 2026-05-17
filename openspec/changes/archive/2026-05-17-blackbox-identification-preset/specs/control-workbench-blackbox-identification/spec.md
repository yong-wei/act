## ADDED Requirements

### Requirement: Black-box preset uses persisted experiment service
The black-box workbench preset SHALL create challenge-mode experiment datasets only through the persisted Arena black-box experiment service.

#### Scenario: Student runs a black-box experiment
- **WHEN** a student runs an experiment in a black-box challenge
- **THEN** the workbench SHALL call `/api/arena/blackbox-experiments`
- **AND** the returned dataset SHALL include a persisted dataset id, dataset hash, budget state, sample data, and data quality summary.

### Requirement: Official target remains hidden
The black-box preset SHALL NOT expose or infer the hidden official transfer function as the official target.

#### Scenario: Black-box session opens
- **WHEN** the black-box preset loads
- **THEN** the session SHALL identify the official target as hidden
- **AND** any model used for plots SHALL be labeled as a student nominal model.

### Requirement: Nominal model can be created from experiment data
The black-box preset SHALL let the student create or import a nominal working model based on an owned experiment dataset.

#### Scenario: Student saves nominal model
- **WHEN** a student saves a nominal model from an experiment dataset
- **THEN** the workbench SHALL record the source dataset hash
- **AND** the nominal model SHALL become available for workbench views and controller drafting.

### Requirement: Virtual preview uses official preview API
The black-box preset SHALL run controller preview through the Arena virtual simulation preview API.

#### Scenario: Student previews black-box controller
- **WHEN** the student previews a black-box controller draft
- **THEN** the workbench SHALL call `/api/arena/virtual-simulation-runs`
- **AND** the result SHALL be shown as preview-only, not as official leaderboard data.

### Requirement: Black-box official submission preserves ownership checks
Black-box official submission SHALL continue to validate dataset ownership before evaluation.

#### Scenario: Artifact references foreign dataset
- **WHEN** a black-box artifact references a dataset hash not owned by the current student for the task
- **THEN** official submission SHALL be rejected before leaderboard insertion.

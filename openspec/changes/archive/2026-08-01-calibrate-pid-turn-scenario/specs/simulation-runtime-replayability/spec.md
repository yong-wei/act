# simulation-runtime-replayability Specification Delta

## MODIFIED Requirements

### Requirement: Replay metadata is emitted
The system SHALL emit replay metadata at simulation trace-producing boundaries, including seed, protocol version, runtime version, model version, scenario id, and checksum. Optimizer replay inputs SHALL additionally include the scoring scenario's heading schedule, simulation duration, reference origin, and actuator rate limit when those inputs affect metrics or score.

#### Scenario: Persisted preview run is created
- **WHEN** a preview or simulation run is persisted
- **THEN** its payload SHALL include enough replay metadata to identify the seed, model version, runtime version, and checksum used for the run

#### Scenario: Calibrated optimizer replay is created
- **WHEN** the PID optimizer produces a recommendation for the calibrated turn scenario
- **THEN** its replay payload SHALL identify `turn90-calibrated-v1`
- **AND** SHALL include the heading schedule, duration, reference origin, and rudder rate limit used for scoring

#### Scenario: Same calibrated replay is repeated
- **WHEN** the same optimizer run context and calibrated scenario inputs are used again
- **THEN** the optimizer SHALL produce the same result summary and replay checksum

# simulation-runtime-replayability Specification

## Purpose
TBD - created by archiving change make-simulation-runtime-replayable. Update Purpose after archive.
## Requirements
### Requirement: Simulation randomness is seeded
The system SHALL route evidence-bearing simulation randomness through a deterministic RNG derived from an explicit run seed.

#### Scenario: Same seed replay
- **WHEN** the same `SceneSpec`, scenario, controller inputs, runtime version, model version, and seed are used
- **THEN** the simulation SHALL produce the same normalized trace summary and replay checksum

#### Scenario: Different seed replay
- **WHEN** a stochastic scene is run with the same inputs but a different seed
- **THEN** the simulation SHALL record the different seed and MAY produce different stochastic outputs

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

### Requirement: Visual-only randomness is separated
The system SHALL distinguish randomness that affects telemetry, scoring, or evidence from visual-only randomness.

#### Scenario: Particle effect uses randomness
- **WHEN** a visual-only effect uses randomness and does not enter trace, scoring, or learning evidence
- **THEN** the effect SHALL NOT be required to participate in replay checksums

### Requirement: Replay service verifies persisted runs
The system SHALL provide a replay verification boundary that resolves persisted run metadata and verifies normalized replay checksums without exposing hidden official evaluation internals.

#### Scenario: Teacher verifies class run
- **WHEN** a teacher requests replay verification for a simulation run from a class they teach
- **THEN** the service SHALL resolve the run id or trace reference, recompute or verify the normalized summary from `SceneSpec`, `EvaluationSpec`, seed, runtime version, model version, and controller artifact, and return checksum status

#### Scenario: Replay checksum mismatch
- **WHEN** the recomputed replay checksum does not match the persisted checksum
- **THEN** the service SHALL return a mismatch state with safe diagnostic metadata and SHALL NOT overwrite the persisted evidence

#### Scenario: Unauthorized replay request
- **WHEN** a user requests replay for a run outside their allowed scope
- **THEN** the service SHALL reject the request before revealing trace, seed, hidden evaluation, or controller details

### Requirement: Replay verification uses canonical SimulationRun metadata
Replay verification SHALL resolve replay inputs through the canonical SimulationRun envelope before verifying checksum or summary consistency.

#### Scenario: Run replay is requested
- **WHEN** replay verification is requested for a supported run
- **THEN** the service SHALL resolve owner scope, run kind, task spec, scene spec version, runtime version, model version, seed, controller snapshot, trace checksum, and summary from SimulationRun and SimulationTrace metadata.

#### Scenario: Unauthorized replay is requested
- **WHEN** the requester is outside the run owner, class, publication, or audit scope
- **THEN** replay verification SHALL fail before returning seed, controller, hidden evaluation, trace, or summary details.

### Requirement: Replay mismatch does not mutate evidence
Replay verification SHALL report mismatch state without overwriting persisted run, trace, or learning evidence.

#### Scenario: Checksum mismatch occurs
- **WHEN** a recomputed replay checksum differs from the persisted checksum
- **THEN** the service SHALL return a mismatch status with safe diagnostic metadata
- **AND** it SHALL NOT rewrite the canonical SimulationRun, SimulationTrace, or materialized LearningFact.


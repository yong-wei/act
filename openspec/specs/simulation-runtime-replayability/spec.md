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
The system SHALL emit replay metadata at simulation trace-producing boundaries, including seed, protocol version, runtime version, model version, scenario id, and checksum.

#### Scenario: Persisted preview run is created
- **WHEN** a preview or simulation run is persisted
- **THEN** its payload SHALL include enough replay metadata to identify the seed, model version, runtime version, and checksum used for the run

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


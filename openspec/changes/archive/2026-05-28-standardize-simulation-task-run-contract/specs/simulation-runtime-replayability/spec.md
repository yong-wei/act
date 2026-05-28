## ADDED Requirements

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

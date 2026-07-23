# control-odyssey-settling-time-semantics Specification

## Purpose
TBD - created by archiving change align-odyssey-settling-time-semantics. Update Purpose after archive.
## Requirements
### Requirement: Odyssey settling time has one authoritative meaning
The system SHALL define `settlingTime` as the simulated response interval from the active reference-step change until the response first enters the settling tolerance and remains there for the required dwell period.

#### Scenario: Response settles after a reference change
- **WHEN** an Odyssey reference step becomes active and the response subsequently remains within tolerance for the required dwell period
- **THEN** `settlingTime` MUST be measured from that reference-step start to the first sustained in-tolerance point
- **AND** the metric MUST use simulation time rather than browser wall-clock time

#### Scenario: Ship completes the route
- **WHEN** the ship reaches the configured route distance
- **THEN** the run MAY complete independently of `settlingTime`
- **AND** the full traversal duration MUST NOT replace the response settling metric

### Requirement: User-facing Odyssey terminology identifies settling time
The system SHALL label human-facing Odyssey and Arena descriptions of `settlingTime` as `调节时间` in Chinese.

#### Scenario: Student reviews a challenge criterion
- **WHEN** a challenge goal or scoring rule refers to the `settlingTime` metric
- **THEN** the interface MUST describe the metric as `调节时间`
- **AND** it MUST NOT describe that metric as `通关时间`

#### Scenario: Student reviews a completed result
- **WHEN** Odyssey presents measured `settlingTime` in a result, explanation, or submission summary
- **THEN** the displayed label MUST be `调节时间`
- **AND** the machine-facing telemetry field MAY remain `settlingTime`

### Requirement: Terminology correction preserves challenge calibration
The system SHALL preserve existing route, threshold, scoring, credit, unlock, and submission behavior while correcting settling-time terminology.

#### Scenario: Deterministic P Level 5 calibration
- **WHEN** the deterministic P Level 5 simulation runs with `Kp=1.6`
- **THEN** the measured settling time MUST remain 2.8 seconds within the existing numeric test tolerance
- **AND** evaluation MUST compare the result with the settling-time criterion rather than traversal wall-clock duration

#### Scenario: Existing challenge values are loaded
- **WHEN** the affected Odyssey challenge configuration is evaluated after this change
- **THEN** the 3000-meter route MUST remain unchanged
- **AND** the existing 2.8-second and 9-second settling-time thresholds MUST remain unchanged
- **AND** score calculation and progression behavior MUST remain unchanged

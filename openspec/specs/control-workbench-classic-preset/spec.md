# control-workbench-classic-preset Specification

## Purpose
TBD - created by archiving change classic-four-view-preset. Update Purpose after archive.
## Requirements
### Requirement: Classic preset renders white-box four-view workbench
The unified control workbench SHALL provide a classic four-view preset for white-box SISO LTI PID and serial-compensator challenges.

#### Scenario: Second-order challenge opens classic preset
- **WHEN** a student opens `/interactive-learning/control-workbench?arenaTask=task-second-order-lead-pid&preset=multi-representation-linkage`
- **THEN** the workbench SHALL render time-domain response, Bode plot, root locus, and Nyquist plot
- **AND** the object SHALL be loaded from the Arena challenge context.

### Requirement: Classic preset preserves correction controls
The classic preset SHALL use the same effective correction parameters as the existing multi-representation workbench.

#### Scenario: PID controller parameters are edited
- **WHEN** a student edits PID-family parameters in the correction panel
- **THEN** the charts SHALL recompute using those effective parameters
- **AND** the official artifact SHALL contain the same effective `kp`, `ki`, and `kd`.

#### Scenario: Serial compensator parameters are edited
- **WHEN** a student edits lead or lag gain and zero/pole frequencies
- **THEN** the charts SHALL recompute using those values
- **AND** the official artifact SHALL contain the same gain, zero frequency, and pole frequency.

### Requirement: Legacy route remains usable
The existing `/interactive-learning/multi-representation-linkage` route SHALL remain available while the classic preset is introduced.

#### Scenario: Old route still opens
- **WHEN** a student opens `/interactive-learning/multi-representation-linkage?arenaTask=task-second-order-lead-pid`
- **THEN** the page SHALL still load the challenge-bound multi-representation workbench
- **AND** official submission behavior SHALL remain unchanged.

### Requirement: Incompatible Arena tasks are rejected
The classic preset SHALL reject Arena tasks that are not compatible with white-box SISO LTI four-view analysis.

#### Scenario: Black-box task targets classic preset
- **WHEN** a black-box task is opened through the classic preset
- **THEN** the workbench SHALL show a Chinese incompatible-workbench message
- **AND** it SHALL NOT render transfer-function charts for the hidden official object.


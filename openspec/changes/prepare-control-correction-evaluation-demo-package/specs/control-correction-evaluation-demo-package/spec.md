## ADDED Requirements

### Requirement: Control-correction demo package is reproducible
The system SHALL provide a reproducible evaluation and demo package for the control-correction learning-path closed loop.

#### Scenario: Demo fixtures are installed
- **WHEN** an authorized developer or service installs the control-correction demo fixtures
- **THEN** the package SHALL create or reset synthetic course, class, student, resource, learner-state, path, execution, simulation/Arena, citation, and intervention records required by the demo
- **AND** it SHALL keep fixtures isolated from production data and document cleanup behavior.

#### Scenario: Demo package is rerun
- **WHEN** the demo package is executed multiple times against the same local or staged environment
- **THEN** it SHALL produce deterministic fixture state or safely reset prior demo records
- **AND** it SHALL NOT duplicate path outcomes, report metrics, citations, or intervention counts.

### Requirement: Control-correction acceptance checks cover the full loop
The package SHALL include automated or scripted acceptance checks for the full control-correction loop.

#### Scenario: Acceptance checks run
- **WHEN** the package acceptance command runs
- **THEN** it SHALL verify learner-state slice, resource graph, path generation, path read, node execution, deviation or fallback, cited Konling coaching, simulation/Arena terminal validation, teacher report metrics, export output, provider capability state, feature flags, and rollback behavior
- **AND** the command SHALL fail when any required capability is missing, blank, unscoped, uncited, or low-confidence without being marked.

#### Scenario: Privacy check runs
- **WHEN** the demo acceptance package verifies output payloads
- **THEN** it SHALL reject raw secrets, real student data, raw answer bodies, private Konling memory, hidden Arena internals, and raw high-frequency traces in student, teacher, or export payloads.

### Requirement: Demo documentation includes evaluation methodology
The demo package SHALL include review-ready documentation for scenario execution and metric interpretation.

#### Scenario: Reviewer reads the package
- **WHEN** a reviewer opens the demo documentation
- **THEN** it SHALL describe the demo storyline, setup steps, expected route checks, API examples, expected metrics, numerator and denominator definitions, confidence markers, provider configuration, deployment notes, rollback notes, and privacy controls
- **AND** every metric claim SHALL reference the governed source family used to compute it.

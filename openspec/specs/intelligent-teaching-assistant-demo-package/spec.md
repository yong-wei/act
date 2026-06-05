# intelligent-teaching-assistant-demo-package Specification

## Purpose
TBD - created by archiving change package-intelligent-teaching-assistant-demo. Update Purpose after archive.
## Requirements
### Requirement: Teaching assistant demo package is reproducible
The system SHALL provide a reproducible demo package for the intelligent teaching assistant closed loop.

#### Scenario: Demo package is installed
- **WHEN** an authorized developer or service installs the demo package
- **THEN** it SHALL create or reset synthetic student, class, goal, diagnosis, path, grading, prep-pack, citation, Konling mode, and report records required by the demo.

#### Scenario: Demo package is rerun
- **WHEN** the package is executed multiple times in the same environment
- **THEN** it SHALL produce deterministic fixture state or safely reset prior demo records
- **AND** it SHALL NOT duplicate path outcomes, grading runs, citations, prep packs, or intervention counts.

### Requirement: Demo acceptance covers product surfaces
The demo package SHALL verify the report's visible product surfaces.

#### Scenario: Acceptance checks run
- **WHEN** demo acceptance is executed
- **THEN** it SHALL verify student diagnosis overview, multi-path selection, resource execution context, document grading workbench, student feedback, teacher report, fixture-backed prep-pack review evidence, Konling modes, citations, and privacy redaction.

### Requirement: Demo package avoids real private data
The demo package SHALL avoid real student data and restricted raw payloads.

#### Scenario: Privacy check runs
- **WHEN** demo payloads and exports are checked
- **THEN** they SHALL reject raw secrets, real student data, raw answer bodies, private Konling memory, hidden Arena internals, and raw high-frequency traces.

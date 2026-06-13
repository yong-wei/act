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
Demo acceptance SHALL cover final competition materials in addition to API payloads.

#### Scenario: Acceptance checks run
- **WHEN** demo acceptance runs for the competition submission
- **THEN** it SHALL verify route screenshots, effect-report export, citation visibility, role boundaries, model/provider note, privacy note, and demo script or asset manifest
- **AND** no unsupported provider or learning-gain claim SHALL be included without source evidence.

### Requirement: Demo package avoids real private data
The demo package SHALL avoid real student data and restricted raw payloads.

#### Scenario: Privacy check runs
- **WHEN** demo payloads and exports are checked
- **THEN** they SHALL reject raw secrets, real student data, raw answer bodies, private Konling memory, hidden Arena internals, and raw high-frequency traces.

### Requirement: Demo package covers the assistant closed loop
The demo package SHALL include professional grading artifacts when the grading workflow is part of the baseline story.

#### Scenario: Demo package is seeded
- **WHEN** the intelligent teaching assistant demo package is installed
- **THEN** it SHALL include at least one converted document, draft criterion assessments, teacher-approved feedback, writeback preview, and student feedback route target
- **AND** grading artifacts SHALL be privacy-reviewed and tied to the baseline class and student records.

### Requirement: Effect report metrics are source-backed
The assistant effect report SHALL be exportable from governed metric snapshots or deterministic demo records.

#### Scenario: Effect metric is generated
- **WHEN** the assistant effect report is exported
- **THEN** metrics SHALL cover grading feedback coverage, teacher override or review rate, path adoption, prep-pack activation or impact, citation coverage, and baseline usage where data is available
- **AND** every metric SHALL include definition, numerator, denominator, source window, source references, exclusions, caveats, confidence, and data-origin marker.

#### Scenario: Real user evidence is imported
- **WHEN** real evidence is used in an effect report
- **THEN** the report SHALL distinguish real and synthetic sources
- **AND** privacy-reviewed aggregation SHALL be required before export.

### Requirement: Demo package preserves privacy and safety boundaries
The demo package SHALL not leak restricted raw data or present unsupported AI claims as measured results.

#### Scenario: Privacy validation runs
- **WHEN** demo payloads, exports, and screenshots are validated
- **THEN** they SHALL reject raw secrets, real student identifiers, raw answer bodies, private Konling memory, hidden Arena internals, and raw high-frequency traces
- **AND** AI-generated suggestions SHALL remain clearly teacher-reviewed where the workflow requires review.

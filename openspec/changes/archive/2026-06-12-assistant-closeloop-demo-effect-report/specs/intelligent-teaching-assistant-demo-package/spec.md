## ADDED Requirements

### Requirement: Demo package covers the assistant closed loop
The teaching assistant demo package SHALL reproduce the complete control-correction assistant closed loop.

#### Scenario: Demo package is seeded
- **WHEN** the demo package is installed or reset
- **THEN** it SHALL create deterministic synthetic records for document submission, conversion, draft grading, teacher approval, writeback, diagnosis snapshots, path options, Konling citations, prep-pack overlay, and effect metrics
- **AND** repeated runs SHALL not duplicate records.

#### Scenario: Demo acceptance runs
- **WHEN** closed-loop demo acceptance is executed
- **THEN** it SHALL verify submission, conversion, draft grading, teacher review, writeback preview, diagnosis refresh, path selection, Konling explanation, prep-pack activation, and effect dashboard readiness.

### Requirement: Effect report metrics are source-backed
The demo and competition effect report SHALL expose metric definitions and source references for every effect claim.

#### Scenario: Effect metric is generated
- **WHEN** the report includes grading time saved, teacher edit rate, path adoption, Arena or simulation improvement, or user feedback metrics
- **THEN** each metric SHALL include numerator, denominator, data window, source references, exclusions, and caveats
- **AND** synthetic metrics SHALL be clearly labeled as synthetic.

#### Scenario: Real user evidence is imported
- **WHEN** real user feedback or classroom data is added to the effect report
- **THEN** the import path SHALL preserve privacy review, consent or authorization metadata, and source separation from synthetic fixtures.

### Requirement: Demo package preserves privacy and safety boundaries
The demo package SHALL not leak restricted raw data or present unsupported AI claims as measured results.

#### Scenario: Privacy validation runs
- **WHEN** demo payloads, exports, and screenshots are validated
- **THEN** they SHALL reject raw secrets, real student identifiers, raw answer bodies, private Konling memory, hidden Arena internals, and raw high-frequency traces
- **AND** AI-generated suggestions SHALL remain clearly teacher-reviewed where the workflow requires review.

## MODIFIED Requirements

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

### Requirement: Demo acceptance covers product surfaces
Demo acceptance SHALL cover final competition materials in addition to API payloads.

#### Scenario: Acceptance checks run
- **WHEN** demo acceptance runs for the competition submission
- **THEN** it SHALL verify route screenshots, effect-report export, citation visibility, role boundaries, model/provider note, privacy note, and demo script or asset manifest
- **AND** no unsupported provider or learning-gain claim SHALL be included without source evidence.

# competition-demo-baseline Specification

## Purpose
Define the deterministic XH-202620 competition baseline for the automatic-control intelligent teaching assistant demo, including the fixed story, synthetic data contract, route ledger, and scriptable acceptance boundary used by later hardening and polish changes.
## Requirements
### Requirement: Competition baseline defines a deterministic assistant story
The system SHALL define one competition baseline story that maps the automatic-control intelligent teaching assistant loop to concrete accounts, routes, data records, and acceptance checks.

#### Scenario: Baseline story is inspected
- **WHEN** a developer or reviewer opens the competition baseline ledger
- **THEN** it SHALL identify the teacher, administrator, and student demo accounts
- **AND** it SHALL list the class, assignment, diagnosis snapshot, path round, Konling session, prep-pack, overlay, and effect-report records used by the story
- **AND** it SHALL map each story step to a concrete route, API, or script.

### Requirement: Demo seed and reset are deterministic
Competition demo data SHALL be reproducible and resettable without contaminating real learner evidence.

#### Scenario: Demo seed is run twice
- **WHEN** the demo seed or reset command is run repeatedly
- **THEN** the same baseline accounts, class, records, and route targets SHALL be produced
- **AND** duplicate rows or conflicting identifiers SHALL NOT be created.

#### Scenario: Demo data is classified
- **WHEN** seeded demo evidence, reports, or metrics are read
- **THEN** each record SHALL expose a synthetic or demo data-origin marker
- **AND** real user evidence SHALL NOT be overwritten or relabeled as demo data.

### Requirement: Competition route ledger is explicit
The competition route ledger SHALL include final visual evidence expectations.

#### Scenario: Final route evidence is generated
- **WHEN** visual evidence is generated for the competition route ledger
- **THEN** teacher grading, student feedback, student diagnosis or evidence, path center, teacher prep-pack, effect report, administrator configuration or provenance, Arena or simulation validation, and homepage entry surfaces SHALL be covered where they are part of the demo
- **AND** each route SHALL include desktop 1440px and mobile 320px expectations or a documented exception.

### Requirement: Baseline acceptance is scriptable
Final competition acceptance SHALL include visual, report, and material checks after product hardening is complete.

#### Scenario: Final competition acceptance is executed
- **WHEN** final competition acceptance runs
- **THEN** it SHALL verify baseline seed/reset, role-scoped route reachability, core surface shell conformance, source-backed effect-report export, and asset-manifest completeness
- **AND** it SHALL record any skipped external video repository step as an explicit out-of-repo dependency.

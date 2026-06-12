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
The baseline SHALL identify the minimum reviewer click path before visual polishing begins.

#### Scenario: Route ledger is generated
- **WHEN** the route ledger is checked
- **THEN** it SHALL include teacher grading workbench, student feedback, student diagnosis or learner-record surface, adaptive path surface, teacher prep-pack or review slot, assistant effect report, and administrator configuration or provenance surface
- **AND** it SHALL identify any route that is only a temporary placeholder, feature-flagged slot, or API export.

### Requirement: Baseline acceptance is scriptable
The baseline SHALL include named verification commands or manual browser checks for the story.

#### Scenario: Baseline acceptance is executed
- **WHEN** a developer runs the baseline acceptance procedure
- **THEN** it SHALL prove seed/reset success, authenticated route reachability, role boundaries, data-origin visibility, and source-backed effect-report payload availability
- **AND** it SHALL NOT require final visual screenshots or production deployment.

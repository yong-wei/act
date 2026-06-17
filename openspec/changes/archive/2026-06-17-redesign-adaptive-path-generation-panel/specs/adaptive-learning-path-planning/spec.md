## ADDED Requirements

### Requirement: Planner consumes structured generation requests
Adaptive path generation SHALL consume structured user-editable request parameters rather than relying on fixed preset goals or opaque chat text.

#### Scenario: Generation request is submitted
- **WHEN** the path center submits a generation request
- **THEN** the planner SHALL receive goal id, time budget, difficulty rhythm, resource preferences, checkpoint preference, external-resource permission, natural-language intent summary, excluded nodes, preferred style, and request timestamp
- **AND** it SHALL preserve those inputs in auditable path request metadata.

#### Scenario: Low-resource generation is requested
- **WHEN** available resources cannot produce three fully executable distinct paths
- **THEN** the planner SHALL still return a comparison bundle with honest preparation-first, locked-future, or evidence-needed states where possible
- **AND** it SHALL NOT fabricate three materially identical path variants.

### Requirement: Planner returns display-ready path option bundles
The planner SHALL return path options with fields needed by the generation panel and comparison view.

#### Scenario: Path options are generated
- **WHEN** the planner returns options to the path center
- **THEN** each option SHALL include style id, label, node ids, active node ids, locked node ids, readiness summary, resource mix, estimated minutes, checkpoint node ids, terminal validation node ids, student-facing reason, expected outcome, and risk note.

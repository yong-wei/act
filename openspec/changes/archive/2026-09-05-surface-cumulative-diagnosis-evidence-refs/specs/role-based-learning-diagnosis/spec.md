## ADDED Requirements

### Requirement: Student cumulative diagnosis preserves evidence provenance

The student-facing cumulative diagnosis SHALL derive its materialization input,
availability state, evidence references, source coverage, confidence, and
limitations from the same governed cumulative portrait read model. It SHALL NOT
require an unrelated goal-specific snapshot in order to be ready.

#### Scenario: Cumulative portrait has evidenced dimensions

- **WHEN** a student has a valid cumulative portrait with one or more evidenced dimensions
- **THEN** each evidenced diagnosis claim SHALL expose a student-safe evidence reference derived from the governed evidence summary
- **AND** the student diagnosis state SHALL reflect the cumulative portrait input rather than an unrelated goal-specific snapshot
- **AND** the evidence count shown by the overview and claim cards SHALL use the same references.

#### Scenario: Cumulative portrait has missing dimensions

- **WHEN** a cumulative portrait contains dimensions without eligible evidence
- **THEN** those dimensions SHALL retain an explicit missing-evidence limitation and no fabricated evidence reference
- **AND** the student view SHALL distinguish missing evidence from a valid low score.

#### Scenario: Cumulative portrait is available but evidence detail is unavailable

- **WHEN** the portrait can be read but its governed evidence detail cannot be safely projected
- **THEN** the student diagnosis SHALL expose an evidence limitation or unavailable state
- **AND** it SHALL NOT report a complete evidence count or source coverage based only on portrait availability.


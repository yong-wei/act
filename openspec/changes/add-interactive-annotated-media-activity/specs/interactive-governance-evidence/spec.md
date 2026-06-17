## ADDED Requirements

### Requirement: Annotated media evidence supports hotspot diagnostics
Annotated media and embedded activity interactions SHALL produce backend evidence for hotspot and evidence-role diagnostics.

#### Scenario: Student submits annotated media evidence
- **WHEN** a student submits a hotspot selection or embedded visual activity
- **THEN** evidence SHALL include media id, selected annotation ids, evidence roles, embedded activity anchor id, answer payload, reveal state, and timestamp
- **AND** the evidence SHALL be queryable by teacher diagnostics.

#### Scenario: Teacher reviews hotspot diagnostics
- **WHEN** the teacher opens diagnostics for annotated media
- **THEN** the system SHALL show most selected hotspots, omitted required hotspots, evidence-role confusion, and submission coverage
- **AND** it SHALL use teaching labels rather than internal ids.

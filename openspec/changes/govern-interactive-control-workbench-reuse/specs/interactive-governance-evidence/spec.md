## ADDED Requirements

### Requirement: Shared control workbench evidence is recorded
Interactive course use of shared control workbench capabilities SHALL generate backend evidence comparable to ordinary activity submissions.

#### Scenario: Student submits after workbench exploration
- **WHEN** a student submits a response from a course-embedded shared control workbench
- **THEN** the submission evidence SHALL include lesson id, step id, module id, capability id, visible panel ids, parameter snapshot, derived result references, answer payload, and timestamp
- **AND** the evidence SHALL be queryable by teacher diagnostics.

#### Scenario: Teacher reviews workbench diagnostics
- **WHEN** the teacher opens diagnostics for a course-embedded workbench module
- **THEN** the system SHALL show submitted count, viewed count, release state, parameter exploration coverage, and common judgment outcomes
- **AND** it SHALL NOT expose student input controls or implementation-only field names.

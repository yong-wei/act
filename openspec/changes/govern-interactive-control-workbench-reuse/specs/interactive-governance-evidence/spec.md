## ADDED Requirements

### Requirement: Shared control workbench evidence is recorded
Interactive course use of shared control workbench capabilities SHALL generate backend evidence comparable to ordinary activity submissions.

#### Scenario: Student submits after workbench exploration
- **WHEN** a student submits a response from a course-embedded shared control workbench
- **THEN** the submission evidence SHALL include event type, client event id, attempt key, trusted source log id, lesson key, step id, module id, component kind, component id, actor role, client event time, schema version, payload, capability id, visible panel ids, parameter snapshot, derived result references, answer payload, and server timestamp
- **AND** the evidence SHALL be queryable by teacher diagnostics.

#### Scenario: Workbench evidence is classified
- **WHEN** a course-embedded workbench records exploration or submission evidence
- **THEN** the evidence contract SHALL classify the event as `InteractionLog` only, `StudentStepResponse`, or `LearningFact` materialization input
- **AND** the classification SHALL define whether the event can affect teacher diagnostics, ability snapshots, or recommendation inputs.

#### Scenario: Teacher reviews workbench diagnostics
- **WHEN** the teacher opens diagnostics for a course-embedded workbench module
- **THEN** the system SHALL show submitted count, viewed count, release state, parameter exploration coverage, and common judgment outcomes
- **AND** it SHALL NOT expose student input controls or implementation-only field names.

#### Scenario: Workbench diagnostics are aggregated
- **WHEN** teacher diagnostics summarize a course-embedded workbench module
- **THEN** the diagnostic contract SHALL define denominator, dedupe key, latest-vs-all-attempt policy, resubmission display, unreleased-student inclusion, and free-text redaction policy
- **AND** diagnostic routes and APIs SHALL be accessible only to teacher or admin roles.

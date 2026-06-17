## ADDED Requirements

### Requirement: Visual stage lifecycle evidence is recorded
Visual stage modules SHALL record enough lifecycle evidence for teacher diagnostics and implementation audit.

#### Scenario: Student views a visual stage
- **WHEN** a student opens a stage module
- **THEN** evidence SHALL include event type, client event id, attempt key, trusted source log id, lesson key, step id, module id, component kind, component id, actor role, client event time, schema version, payload, visible layer ids, release state, reveal state, theme, viewport, and server timestamp
- **AND** this evidence SHALL be available to teacher diagnostics.

#### Scenario: Stage event layer is classified
- **WHEN** a visual stage records view, release, reveal, highlight, or embedded-activity anchor evidence
- **THEN** the component contract SHALL declare whether the event is `InteractionLog` only, `StudentStepResponse`, or `LearningFact` materialization input
- **AND** view and reveal events SHALL NOT be treated as mastery evidence unless a declared activity response is submitted.

#### Scenario: Teacher changes stage reveal state
- **WHEN** a teacher releases, hides, reveals, jumps, or highlights a stage layer
- **THEN** the event SHALL be recorded with stage id, target layer ids, previous state, next state, actor role, and timestamp
- **AND** student-visible state SHALL be recoverable after refresh.

#### Scenario: Stage diagnostics are aggregated
- **WHEN** teacher diagnostics summarize a visual stage
- **THEN** the diagnostic contract SHALL define denominator, dedupe key, latest-vs-all-attempt policy, resubmission display, unreleased-student inclusion, and free-text redaction policy
- **AND** diagnostic routes and APIs SHALL be accessible only to teacher or admin roles.

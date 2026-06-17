## ADDED Requirements

### Requirement: Structure diagram evidence supports teacher diagnostics
Block diagram and signal-flow graph interactions SHALL produce backend evidence for structural misconceptions.

#### Scenario: Student submits a structure diagram interaction
- **WHEN** a student submits a graph selection or construction
- **THEN** evidence SHALL include event type, client event id, attempt key, trusted source log id, lesson key, step id, module id, component kind, component id, actor role, client event time, schema version, payload, graph id, selected nodes, selected paths, selected loops, constructed positions, connection differences, reveal state, and server timestamp
- **AND** the evidence SHALL be queryable by teacher diagnostics.

#### Scenario: Structure diagram event layer is classified
- **WHEN** a block diagram or signal-flow graph records selection, construction, reveal, feedback, or submission evidence
- **THEN** the component contract SHALL declare whether the event is `InteractionLog` only, `StudentStepResponse`, or `LearningFact` materialization input
- **AND** graph browsing or highlighting alone SHALL NOT be treated as mastery evidence without a declared response or scoring rule.

#### Scenario: Teacher reviews graph diagnostics
- **WHEN** the teacher opens diagnostics for a structure diagram module
- **THEN** the system SHALL show node/path/loop selection distribution, common missing links, common extra links, and reveal coverage
- **AND** it SHALL present teaching labels rather than raw manifest ids.

#### Scenario: Graph diagnostics are aggregated
- **WHEN** teacher diagnostics summarize block diagram or signal-flow graph interactions
- **THEN** the diagnostic contract SHALL define denominator, dedupe key, latest-vs-all-attempt policy, resubmission display, unreleased-student inclusion, and free-text redaction policy
- **AND** diagnostic routes and APIs SHALL be accessible only to teacher or admin roles.

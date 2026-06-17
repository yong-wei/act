## ADDED Requirements

### Requirement: Visual component evidence samples are mandatory
Interactive visual components that collect or imply student interaction SHALL provide backend evidence samples before acceptance.

#### Scenario: Evidence-producing visual component is reviewed
- **WHEN** a visual component supports selection, construction, reveal browsing, hotspot selection, embedded activity answer, parameter exploration, or graph diagnosis
- **THEN** the acceptance artifact SHALL include a backend evidence sample with event type, client event id, attempt key, trusted source log id when persisted, lesson key, step id, module id, component kind, component id, actor role, client event time, schema version, payload, and server timestamp
- **AND** the sample SHALL be sufficient for teacher diagnostics to read the interaction.

#### Scenario: Evidence layer is not declared
- **WHEN** a visual component records interaction evidence
- **THEN** the component contract SHALL declare whether each event is `InteractionLog` only, `StudentStepResponse`, or `LearningFact` materialization input
- **AND** it SHALL declare whether the event can affect teacher diagnostics, ability snapshots, or recommendation inputs.

#### Scenario: Evidence cannot be traced through governance stores
- **WHEN** a classroom session exists for validation
- **THEN** evidence source coverage SHALL be able to associate component evidence across `InteractionLog`, `StudentStepResponse`, and `LearningFact` according to the declared layer
- **AND** missing or forged source log ids SHALL fail the evidence gate.

#### Scenario: Teacher diagnostics are missing
- **WHEN** a visual component records student interaction but has no teacher-readable diagnostic summary
- **THEN** acceptance SHALL fail
- **AND** the implementation SHALL add diagnostics before completion.

#### Scenario: Teacher diagnostic aggregation is undefined
- **WHEN** a visual component produces teacher diagnostics
- **THEN** the diagnostic contract SHALL define denominator, dedupe key, latest-vs-all-attempt policy, resubmission display, unreleased-student inclusion, and free-text redaction policy
- **AND** teacher-facing labels SHALL use teaching semantics rather than raw ids.

#### Scenario: Teacher diagnostics are exposed to the wrong role
- **WHEN** a student, guest, or unreleased view can access teacher diagnostic routes, APIs, or aggregation payloads
- **THEN** acceptance SHALL fail
- **AND** the data exposure SHALL be treated as a blocking governance issue.

#### Scenario: Visual state is not recoverable
- **WHEN** a student or teacher refreshes a page after release, reveal, answer reveal, selection, submission, or diagnostics aggregation
- **THEN** the relevant visual component state SHALL be recoverable according to the component contract
- **AND** unrecoverable state SHALL fail acceptance for evidence-producing components.

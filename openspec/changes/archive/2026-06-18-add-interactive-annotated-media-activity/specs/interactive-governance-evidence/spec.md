## ADDED Requirements

### Requirement: Annotated media evidence supports hotspot diagnostics
Annotated media and embedded activity interactions SHALL produce backend evidence for hotspot and evidence-role diagnostics.

#### Scenario: Student submits annotated media evidence
- **WHEN** a student submits a hotspot selection or embedded visual activity
- **THEN** evidence SHALL include event type, client event id, attempt key, trusted source log id, lesson key, step id, module id, component kind, component id, actor role, client event time, schema version, payload, media id, selected annotation ids, evidence roles, embedded activity anchor id, answer payload, reveal state, and server timestamp
- **AND** the evidence SHALL be queryable by teacher diagnostics.

#### Scenario: Annotated media event layer is classified
- **WHEN** annotated media records hotspot focus, hotspot selection, reveal browsing, embedded activity answer, or submission evidence
- **THEN** the component contract SHALL declare whether the event is `InteractionLog` only, `StudentStepResponse`, or `LearningFact` materialization input
- **AND** hotspot browsing alone SHALL NOT be treated as mastery evidence without a declared response or scoring rule.

#### Scenario: Teacher reviews hotspot diagnostics
- **WHEN** the teacher opens diagnostics for annotated media
- **THEN** the system SHALL show most selected hotspots, omitted required hotspots, evidence-role confusion, and submission coverage
- **AND** it SHALL use teaching labels rather than internal ids.

#### Scenario: Hotspot diagnostics are aggregated
- **WHEN** teacher diagnostics summarize annotated media or embedded visual activities
- **THEN** the diagnostic contract SHALL define denominator, dedupe key, latest-vs-all-attempt policy, resubmission display, unreleased-student inclusion, and free-text redaction policy
- **AND** diagnostic routes and APIs SHALL be accessible only to teacher or admin roles.

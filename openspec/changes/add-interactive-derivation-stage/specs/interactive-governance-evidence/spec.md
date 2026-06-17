## ADDED Requirements

### Requirement: Derivation stage evidence supports teacher diagnostics
Derivation stage interactions SHALL produce backend evidence for reveal progress, formula focus, and misconception analysis.

#### Scenario: Student views and submits a derivation stage
- **WHEN** a student interacts with a derivation stage
- **THEN** evidence SHALL include event type, client event id, attempt key, trusted source log id, lesson key, step id, module id, component kind, component id, actor role, client event time, schema version, payload, stage id, max reveal step seen, visited reveal steps, formula block focus events, active highlight ids, student answers by reveal step, and server timestamp
- **AND** the evidence SHALL be associated with the declared `InteractionLog`, `StudentStepResponse`, or `LearningFact` classification.

#### Scenario: Derivation event layer is classified
- **WHEN** derivation stage records reveal browsing, formula focus, answer submission, feedback, or teacher reveal evidence
- **THEN** the component contract SHALL declare whether the event is `InteractionLog` only, `StudentStepResponse`, or `LearningFact` materialization input
- **AND** browsing and focus events SHALL NOT be treated as mastery evidence without a declared response or scoring rule.

#### Scenario: Teacher reviews derivation diagnostics
- **WHEN** the teacher opens diagnostics for a derivation stage
- **THEN** the system SHALL show reveal step distribution, unvisited step counts, formula block focus distribution, submitted count, and common misconceptions by reveal step
- **AND** teacher diagnostics SHALL NOT expose implementation-only ids as visible teaching labels.

#### Scenario: Derivation diagnostics are aggregated
- **WHEN** teacher diagnostics summarize a derivation stage
- **THEN** the diagnostic contract SHALL define denominator, dedupe key, latest-vs-all-attempt policy, resubmission display, unreleased-student inclusion, and free-text redaction policy
- **AND** diagnostic routes and APIs SHALL be accessible only to teacher or admin roles.

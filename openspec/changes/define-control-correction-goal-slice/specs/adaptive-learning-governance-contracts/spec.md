## ADDED Requirements

### Requirement: Control-correction learner-state fields are governed
The system SHALL govern control-correction learner-state fields through the shared adaptive-learning privacy, confidence, evaluation-event, and rollback contracts.

#### Scenario: Control-correction field family is introduced
- **WHEN** a control-correction learner-state field family is added
- **THEN** it SHALL declare student-visible, teacher-scoped, admin-scoped, audit-only, or system-internal visibility
- **AND** raw dialogue, raw answer bodies, hidden Arena evaluator internals, raw high-frequency traces, and private memory payloads SHALL remain restricted unless a redacted derivative is explicitly defined.

#### Scenario: Goal-slice evaluation event is emitted
- **WHEN** the control-correction learner-state slice is refreshed or read for evaluation
- **THEN** the evaluation event SHALL use the shared adaptive-learning envelope
- **AND** it SHALL include stable references, confidence state, source coverage, and privacy level rather than embedding sensitive raw payloads.

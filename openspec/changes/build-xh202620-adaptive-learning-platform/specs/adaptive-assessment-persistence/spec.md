## ADDED Requirements

### Requirement: Adaptive assessment state is persistent
The system SHALL persist adaptive assessment sessions, selected questions, submitted answers, timing, ability estimates, and knowledge-tag updates rather than relying on in-memory process state.

#### Scenario: Assessment survives server restart
- **WHEN** a student answers adaptive assessment questions and the application process restarts
- **THEN** the student's prior answers, session state, ability estimate, and diagnostic state SHALL remain available from persistent storage.

#### Scenario: Next question uses persistent history
- **WHEN** the system selects the next adaptive question
- **THEN** it SHALL use persisted answer history and current learner state
- **AND** it SHALL avoid selecting already-answered questions in the active session unless a review mode explicitly permits repetition.

### Requirement: Assessment evidence enters the governed evidence pipeline
The system SHALL materialize adaptive assessment outcomes into governed learning evidence.

#### Scenario: Submitted answer creates governed fact
- **WHEN** a student submits an adaptive assessment answer
- **THEN** the system SHALL persist a durable answer row
- **AND** it SHALL create or enqueue a governed `LearningFact` with score, knowledge tags, ability estimate, source references, and privacy-safe context.

#### Scenario: Question content remains protected
- **WHEN** assessment evidence is used by learner state, path planning, or teacher insight
- **THEN** the derived payload SHALL reference question id, tags, score, timing, and confidence
- **AND** it SHALL NOT expose full question stems or answer text outside authorized assessment drilldown.

### Requirement: Ability updates are reproducible
The system SHALL make ability and mastery updates reproducible from persisted inputs.

#### Scenario: Recompute ability from unchanged evidence
- **WHEN** ability estimates are rebuilt from unchanged persisted assessment records
- **THEN** the resulting estimates SHALL be stable within the declared algorithm version
- **AND** the output SHALL record the algorithm version and evidence window.

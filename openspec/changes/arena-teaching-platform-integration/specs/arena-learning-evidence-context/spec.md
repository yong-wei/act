## ADDED Requirements

### Requirement: Arena learning facts preserve Arena context
Arena high-value learning facts SHALL retain task, object, method, score, validity, artifact, metric profile, leaderboard policy, and publication/class context where available.

#### Scenario: Valid evaluation fact
- **WHEN** an `arena_evaluation_complete` event with valid official result is materialized
- **THEN** the resulting learning evidence MUST include the Arena task id, method, score, valid state, and artifact hash in queryable or recoverable context

#### Scenario: Constraint failure fact
- **WHEN** an `arena_evaluation_complete` event represents a failed hard constraint
- **THEN** the resulting learning evidence MUST preserve the failed validity state and enough metric context for teacher insight aggregation

### Requirement: Arena evidence can be aggregated for class insight
The system SHALL support aggregating Arena learning evidence by class, publication, task, method, and validity.

#### Scenario: Teacher class insight
- **WHEN** a teacher views Arena performance for a class publication
- **THEN** the system MUST be able to aggregate valid submission rate, score distribution, weak metrics, and method distribution from persisted evidence and submissions

### Requirement: Low-value Arena view events do not become competency facts
The system SHALL avoid materializing low-value Arena view events as competency facts.

#### Scenario: Leaderboard view event
- **WHEN** `arena_leaderboard_view` is received
- **THEN** it MUST NOT create a LearningFact unless a future spec explicitly marks it as high-value evidence

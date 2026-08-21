# konling-candidate-path-selection Specification

## Purpose
Define how Konling resolves, confirms, and synchronizes a learner's choice from an authorized immutable adaptive-path candidate batch without reranking candidates or starting learning.
## Requirements
### Requirement: Candidate selection uses an authorized persisted batch
Konling SHALL resolve a student's path choice only against an immutable candidate batch authorized for the current actor, learner, LearningGoal, and path context.

#### Scenario: Explicit candidate identity is valid
- **WHEN** a selection action supplies a `batchId` and `candidateId` that identify a candidate in the authorized persisted batch
- **THEN** the system SHALL resolve that exact candidate
- **AND** it SHALL NOT reconstruct identity from candidate title, ordinal, assistant prose, or a new planner result.

#### Scenario: Candidate identity is outside the authorized batch
- **WHEN** the batch is unavailable, outside scope, bound to a different goal or source path, or does not contain the supplied candidate
- **THEN** the system SHALL reject the selection without writing path choice or execution state.

### Requirement: Natural-language selection is uniquely resolved or clarified
Konling SHALL classify a natural-language choice only over candidates in the authorized batch and SHALL mutate selection state only when exactly one candidate is identified.

#### Scenario: Utterance identifies one candidate
- **WHEN** the student's utterance uniquely identifies one candidate in the authorized batch
- **THEN** the resolver SHALL return that candidate's persisted `batchId` and `candidateId`
- **AND** it SHALL preserve all candidate snapshots, order, labels, and recommendation provenance.

#### Scenario: Utterance is ambiguous
- **WHEN** the student's utterance matches multiple candidates or does not distinguish one candidate
- **THEN** Konling SHALL return a bounded clarification question with student-safe alternatives from the same batch
- **AND** it SHALL NOT select, rerank, rewrite, or execute any candidate.

#### Scenario: Utterance does not resolve
- **WHEN** the student's utterance identifies no candidate in the authorized batch
- **THEN** Konling SHALL return an unresolved result without side effects.

### Requirement: Confirmed selection uses the governed path-choice write path
Konling SHALL commit a uniquely resolved candidate through the existing governed path-choice contract with audit and idempotency controls.

#### Scenario: Unique selection is committed
- **WHEN** the resolver returns one verified candidate
- **THEN** the system SHALL invoke the existing path-choice mutation using the verified batch and candidate identities
- **AND** the resulting structured action SHALL reference the same identities.

#### Scenario: Confirmed selection is repeated
- **WHEN** the same owner repeats the confirmed selection with the same idempotency identity
- **THEN** the system SHALL return the existing result without creating a duplicate choice or active path round.

### Requirement: Selection synchronizes presentation without starting learning
A successful Konling selection SHALL synchronize the adaptive path center to the same persisted batch and candidate while keeping path execution idle.

#### Scenario: Selected action reaches the path center
- **WHEN** a Konling selection succeeds
- **THEN** the client SHALL refresh or navigate the adaptive path center with the verified `batchId` and `candidateId`
- **AND** the page SHALL derive its selected state from authorized server data.

#### Scenario: Selection completes without execution
- **WHEN** the path choice is persisted
- **THEN** the system SHALL NOT call path execution, create node execution state, or advance learning
- **AND** learning SHALL begin only after a separate explicit student start action.

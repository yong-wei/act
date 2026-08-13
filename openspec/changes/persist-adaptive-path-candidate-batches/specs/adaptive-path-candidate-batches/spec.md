## ADDED Requirements

### Requirement: Successful generation persists an immutable candidate batch
The system SHALL persist each explicitly successful adaptive path generation as one candidate batch containing the planner-produced candidates in their original order, and SHALL NOT create a successful batch for active, blocked, failed, or transport-unknown generation states.

#### Scenario: Successful generation creates one batch
- **WHEN** a generation request reaches the explicit succeeded state with planner candidates
- **THEN** the system persists one successful batch and its ordered candidates

#### Scenario: Active or unknown generation creates no successful batch
- **WHEN** a generation request is pending, running, awaiting approval, or has an unknown transport outcome
- **THEN** the system does not expose a successful candidate batch for that request

### Requirement: Generation retries are idempotent by request identity
The system SHALL associate at most one candidate batch with a generation request identity and SHALL return the same batch and candidate identities when the same request is retried.

#### Scenario: Retried successful request reuses the batch
- **WHEN** the same `generationRequestId` is submitted after its candidate batch was persisted
- **THEN** the system returns the existing batch without creating or rewriting candidates

### Requirement: Candidate identity is stable and server-owned
Every persisted candidate SHALL have a stable identifier scoped to its batch, and consumers MUST NOT infer candidate identity from its title, label, ordinal, or conversation text.

#### Scenario: Candidate is reopened by identifier
- **WHEN** an authorized consumer reads a candidate by batch ID and candidate ID
- **THEN** the system returns the originally persisted planner candidate regardless of display-label changes

### Requirement: Candidate batches are separate from selected and executing paths
Persisting a new candidate batch SHALL NOT replace, reset, or mutate the learner's selected, active, fallback, or completed `LearningPath`.

#### Scenario: New generation preserves active execution
- **WHEN** a learner with an active path successfully generates a newer candidate batch
- **THEN** the active path, current node, execution evidence, and terminal validation remain unchanged

### Requirement: Candidate batch reads enforce learner ownership
The system SHALL authorize exact and latest candidate-batch reads using the same learner, teacher-class, and administrator boundaries as learning-path reads.

#### Scenario: Student reads own latest batch
- **WHEN** a student requests the latest successful batch for their own registered goal
- **THEN** the system returns the newest successful batch ordered by server creation time

#### Scenario: Student requests another learner batch
- **WHEN** a student requests a batch owned by another learner
- **THEN** the system denies the request without disclosing batch contents

### Requirement: Candidate snapshots preserve planner output
The system SHALL preserve the planner's candidate ordering, policy identity, executable nodes, explanations, limitations, resource mix, and version metadata without re-ranking or rewriting them.

#### Scenario: Batch projection matches planner result
- **WHEN** a persisted batch is read by Konling or the path center
- **THEN** both consumers receive projections derived from the same immutable candidate snapshots

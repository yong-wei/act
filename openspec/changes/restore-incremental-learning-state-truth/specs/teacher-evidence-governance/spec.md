## MODIFIED Requirements

### Requirement: Teacher analytics refresh affected class state incrementally

Teacher class analytics SHALL reuse the existing class snapshot materialization path when a learner's state-changing update affects that learner's current class.

#### Scenario: A learner state update affects a class

- **WHEN** the learner snapshot worker writes a state update for a learner with a current class
- **THEN** it SHALL durably stage the existing class snapshot outbox row and promptly enqueue that class's existing snapshot job
- **AND** the teacher class reader SHALL observe the updated class snapshot after the job completes.

#### Scenario: No learner state update occurs

- **WHEN** a learner job processes context-only, duplicate, unchanged, or age-only input
- **THEN** it SHALL NOT stage or enqueue class materialization
- **AND** teacher analytics SHALL retain the existing class snapshot.

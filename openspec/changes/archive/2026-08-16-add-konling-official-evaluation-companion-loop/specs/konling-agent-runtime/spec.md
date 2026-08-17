## ADDED Requirements

### Requirement: Konling intervention records retain official-evaluation round evidence
When a companion intervention is created from an official Arena submission, the Konling runtime SHALL persist the scoped official submission reference as intervention evidence and SHALL preserve it for a same-task follow-up comparison.

#### Scenario: Official-evaluation intervention is persisted
- **WHEN** the runtime records a companion intervention from a supported official submission
- **THEN** the intervention evidence includes the triggering official submission reference and task identity
- **AND** the reference remains restricted to the intervention owner's authorized scope

### Requirement: Konling cooldown deduplicates one official result
The Konling runtime SHALL prevent duplicate companion interventions for the same scoped official submission. A completed same-task follow-up comparison MUST permit a new intervention that is grounded in the follow-up submission even if an earlier time-based cooldown has not elapsed.

#### Scenario: Same official result is revisited
- **WHEN** the client repeats a request for a companion intervention for the same official submission
- **THEN** the runtime returns or reuses the existing intervention outcome
- **AND** it does not create a second intervention record

#### Scenario: Follow-up is a new official result
- **WHEN** a follow-up official submission has closed the prior intervention round and meets an intervention condition
- **THEN** the runtime permits a new scoped intervention for that follow-up submission

### Requirement: Companion feedback remains non-authoritative
The Konling runtime SHALL persist a student's companion helpfulness feedback as an intervention outcome within the existing privacy and scope controls. That feedback MUST NOT be treated as proof of task attainment, knowledge mastery, or a request to mutate a learning path.

#### Scenario: Student rates companion advice
- **WHEN** a student submits helpfulness feedback for a companion intervention
- **THEN** the runtime records the intervention outcome and its evidence reference
- **AND** it does not create or alter a learning-path plan, task-standard result, or mastery conclusion

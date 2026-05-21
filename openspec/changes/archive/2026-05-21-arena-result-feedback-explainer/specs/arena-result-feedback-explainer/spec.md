## ADDED Requirements

### Requirement: Arena submissions expose official result explanations
The system SHALL explain official Arena submission results using score, validity, hard constraints, metric satisfaction, and protocol metadata.

#### Scenario: Student submits a controller
- **WHEN** official evaluation completes
- **THEN** the student can see whether the result ranked, why it did or did not rank, and which metrics most affected the score

### Requirement: Feedback distinguishes preview from official evaluation
The system SHALL clearly separate local preview results from official Arena evaluation.

#### Scenario: Preview metrics differ from official metrics
- **WHEN** a task has official-only or hidden metrics
- **THEN** the feedback states that those metrics appear only after official evaluation

### Requirement: Feedback compares against personal history
The system SHALL compare the latest submission with the student's prior submissions for the same task when available.

#### Scenario: Student improves personal best
- **WHEN** the latest score exceeds the previous personal best
- **THEN** the feedback identifies the improvement and preserves the next actionable metric suggestion

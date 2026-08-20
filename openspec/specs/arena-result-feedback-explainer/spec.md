## Purpose
Define official Arena submission feedback that explains ranking status, metric evidence, protocol boundaries, and personal-history comparison.
## Requirements
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

### Requirement: Official result feedback exposes scoped companion advice
The official Arena result feedback surface SHALL display at most one expandable Konling companion card when the current supported control-workbench submission has a scoped companion intervention. The card SHALL distinguish official evidence from companion advice.

#### Scenario: Official result has companion intervention
- **WHEN** a supported official evaluation completes with a companion intervention
- **THEN** the result surface shows the current official hard-constraint labels, reasons, and relevant official metrics separately from the companion's next adjustment direction
- **AND** it provides an optional helpfulness feedback action

#### Scenario: Official result has no companion intervention
- **WHEN** the submission does not meet a companion intervention condition
- **THEN** the result surface does not display an empty or generic companion card

### Requirement: Official result feedback presents verified companion follow-up
The official Arena result feedback surface SHALL show a companion follow-up comparison only when the current submission closes a prior same-task companion intervention round. It SHALL compare the current official result with that intervention's baseline result.

#### Scenario: Same-task resubmission closes a round
- **WHEN** a student submits the same task after a companion intervention
- **THEN** the result surface presents official metric differences and hard-constraint state changes against the stored baseline
- **AND** it does not claim that a positive single-metric difference proves the controller is better

#### Scenario: Submission is unrelated to a prior intervention
- **WHEN** a current submission has no preceding companion intervention for the same task
- **THEN** the result surface does not present it as a companion follow-up comparison


## ADDED Requirements

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

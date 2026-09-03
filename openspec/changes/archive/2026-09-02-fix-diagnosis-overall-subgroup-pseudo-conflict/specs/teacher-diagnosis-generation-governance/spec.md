## MODIFIED Requirements

### Requirement: Diagnosis generation enforces evidence comparability for conflicts
The diagnosis generator SHALL declare an evidence conflict only when the conflicting evidence covers the same student scope within a close time window and points in opposite directions. A statement that the class overall performs normally combined with a statement that a part of the students lags behind SHALL NOT be declared as an evidence conflict.

#### Scenario: Overall-normal plus subgroup-weak wording appears
- **WHEN** the generated summary or limitations combine an overall-normal statement with a subgroup-weak statement and label it as a conflict
- **THEN** the generation attempt SHALL fail with a retryable model-behavior error before persistence
- **AND** the job SHALL requeue within the existing attempt budget.

#### Scenario: Comparable conflict appears
- **WHEN** opposite-direction evidence covers the same student cohort in a close time window (for example high homework scores and low assessment scores for the same batch of students)
- **THEN** the generator MAY declare an evidence conflict, write it into limitations, and lower confidence.

#### Scenario: Historical report contains a pseudo conflict
- **WHEN** a persisted historical report's projection detects an overall-vs-subgroup pseudo conflict
- **THEN** the teacher-facing view SHALL present the report as needing regeneration with an accurate reason
- **AND** it SHALL NOT present the pseudo conflict as「证据存在冲突」
- **AND** the historical report body SHALL remain immutable.

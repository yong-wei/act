## MODIFIED Requirements

### Requirement: Diagnosis generation enforces evidence comparability for conflicts
The diagnosis generator SHALL declare an evidence conflict only when the conflicting evidence covers the same student scope within a close time window and points in opposite directions. Cited assignment and assessment evidence SHALL belong to the same student or to a consistent student group in which every cited student has both sources. Assignment `reviewedAt` and assessment `completedAt` SHALL differ by at most 14 days. A directional claim such as high homework and low assessment SHALL be proved by the cited normalized scores. A statement that the class overall performs normally combined with a statement that a part of the students lags behind SHALL NOT be declared as an evidence conflict. Cross-student mismatch, equal scores, opposite-of-claimed direction, or incomparable time windows SHALL be rejected as a retryable model-behavior defect before persistence.

#### Scenario: Overall-normal plus subgroup-weak wording appears
- **WHEN** the generated summary or limitations combine an overall-normal statement with a subgroup-weak statement and label it as a conflict
- **THEN** the generation attempt SHALL fail with a retryable model-behavior error before persistence
- **AND** the job SHALL requeue within the existing attempt budget.

#### Scenario: Comparable conflict appears
- **WHEN** opposite-direction evidence covers the same student cohort in a close time window (for example high homework scores and low assessment scores for the same batch of students)
- **THEN** the generator MAY declare an evidence conflict, write it into limitations, and lower confidence.

#### Scenario: Cited assignment and assessment belong to different students
- **WHEN** a conflict finding cites one assignment record and one assessment record that belong to different students
- **THEN** the generation attempt SHALL fail with a retryable model-behavior error before persistence.

#### Scenario: Cited scores are equal
- **WHEN** a directional conflict claim cites assignment and assessment scores that are equal after normalization
- **THEN** the generation attempt SHALL fail with a retryable model-behavior error before persistence.

#### Scenario: Cited scores contradict the claimed direction
- **WHEN** a claim of high homework and low assessment is backed by cited scores whose direction does not match
- **THEN** the generation attempt SHALL fail with a retryable model-behavior error before persistence.

#### Scenario: Cited timestamps are not comparable
- **WHEN** a conflict claim cites assignment and assessment records whose `reviewedAt` and `completedAt` differ by more than 14 days or either timestamp is missing
- **THEN** the generation attempt SHALL fail with a retryable model-behavior error before persistence.

#### Scenario: Historical report contains a pseudo conflict
- **WHEN** a persisted historical report's projection detects an overall-vs-subgroup pseudo conflict
- **THEN** the teacher-facing view SHALL present the report as needing regeneration with an accurate reason
- **AND** it SHALL NOT present the pseudo conflict as「证据存在冲突」
- **AND** the historical report body SHALL remain immutable.

#### Scenario: Historical report contains an unverifiable conflict claim
- **WHEN** a persisted historical report declares a conflict but the cited evidence cannot be verified as same-student, close-window, opposite-direction proof
- **THEN** the teacher-facing view SHALL present the report as needing regeneration or manual review
- **AND** it SHALL NOT present the unverifiable claim as「证据存在冲突」
- **AND** the historical report body SHALL remain immutable.

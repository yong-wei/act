## MODIFIED Requirements

### Requirement: Official evaluation explanations and hard constraints are Chinese
Official evaluation results shown to students SHALL use Chinese hard-constraint labels, Chinese explanations, and metric comparison rows that place target or threshold values next to actual values.

#### Scenario: Failed hard constraint is readable
- **WHEN** an official submission fails a hard constraint
- **THEN** the workbench SHALL show a Chinese hard-constraint label and Chinese reason
- **AND** raw ids such as `finite_response` SHALL NOT be the student-facing label.

#### Scenario: Official metrics compare target and actual values
- **WHEN** an official submission returns ranking metrics or hard-threshold metrics
- **THEN** the official submission module SHALL show Chinese metric labels, target or threshold values, actual values, and status for each displayed metric
- **AND** status color SHALL indicate whether the metric reached the target, is near the target, or failed the target.

#### Scenario: Valid zero score is explained
- **WHEN** an official submission passes hard constraints but receives final score `0`
- **THEN** the official submission module SHALL state in Chinese that the hard constraints passed
- **AND** it SHALL explain that the zero score comes from ranking metric satisfaction or scoring aggregation, not from a failed official submission.

#### Scenario: Raw English evaluator notes are hidden
- **WHEN** official evaluation includes provider or evaluator notes in English
- **THEN** those raw English notes SHALL NOT be shown directly to students
- **AND** any displayed explanation SHALL be Chinese.

## ADDED Requirements

### Requirement: Canonical response kinds use shared structural scoring
The objective scorer SHALL score canonical objective response kinds and their migration aliases through one shared implementation.

#### Scenario: Multi-choice canonical scoring
- **WHEN** a submitted `choice.multi` answer contains some correct options, missed correct options, extra wrong options, or duplicate options
- **THEN** the scoring detail SHALL identify those structural parts
- **AND** the normalized score SHALL reflect partial credit according to the shared policy.

#### Scenario: Ordering canonical scoring
- **WHEN** a submitted `ordering.sequence` answer has only part of the sequence in the correct position or relation
- **THEN** the scoring detail SHALL expose the matched and misplaced structure
- **AND** the answer SHALL NOT be treated as merely correct or incorrect by text equality.

#### Scenario: Matching canonical scoring
- **WHEN** a submitted `matching.pairs` answer provides the correct item-option pairs in a different pair order than the reference
- **THEN** the answer SHALL be scored as structurally equivalent
- **AND** each prompt-side item SHALL be compared with its submitted answer-side option.

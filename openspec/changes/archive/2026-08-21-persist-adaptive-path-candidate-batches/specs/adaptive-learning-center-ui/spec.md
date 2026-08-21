## ADDED Requirements

### Requirement: Path comparison reads persisted candidate batches
The adaptive learning center SHALL render the existing comparison workspace from a persisted candidate batch and SHALL default to the learner's latest successful batch when no batch is specified.

#### Scenario: Center opens latest comparison
- **WHEN** the learner opens the path center without a batch query parameter and successful batches exist
- **THEN** the existing comparison UI displays the newest successful batch

#### Scenario: Current path remains visible
- **WHEN** the latest candidate batch differs from the learner's selected or executing path
- **THEN** the center preserves and displays the current-path state independently from the candidate comparison

### Requirement: Candidate comparison supports stable deep links
The adaptive learning center SHALL support a batch ID and optional candidate ID in the URL, focus a valid candidate in the existing comparison UI, and retain an action to compare every candidate in the batch.

#### Scenario: Valid candidate deep link
- **WHEN** an authorized learner opens a URL containing a valid batch and candidate ID
- **THEN** the comparison focuses that candidate and offers an action to show the full batch

#### Scenario: Invalid candidate deep link
- **WHEN** the candidate ID does not belong to the requested batch
- **THEN** the center fails closed and does not substitute a candidate by title or ordinal

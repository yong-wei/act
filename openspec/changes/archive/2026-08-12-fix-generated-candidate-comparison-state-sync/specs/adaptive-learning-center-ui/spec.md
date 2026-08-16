## ADDED Requirements

### Requirement: Successful path generation updates the integrated comparison surface immediately
The adaptive learning center SHALL synchronize a successfully generated, authorized candidate batch with the current generation workspace so that the active path, generation controls, and candidate comparison remain available in one integrated interface without a manual reload.

#### Scenario: Authenticated student generates candidates while an active path exists
- **WHEN** an authenticated student with an active learning path successfully generates an authorized candidate batch from the generation workspace
- **THEN** the same page SHALL retain the current-path continuation and generation controls
- **AND** it SHALL immediately display and expand the generated candidate comparison before any reload
- **AND** the route state SHALL identify the same persisted candidate batch.

#### Scenario: Student reloads the successful generation route
- **WHEN** the student reloads or reopens the generation route containing the authorized candidate batch identifier
- **THEN** the center SHALL restore the same candidate comparison and current active path.

#### Scenario: Student continues the active path
- **WHEN** the student chooses to continue the current active path instead of generating or selecting a new candidate
- **THEN** the execution workspace SHALL not display an unrelated candidate comparison flow.

#### Scenario: Candidate batch belongs to another learner
- **WHEN** a student requests a candidate batch that is not authorized for that learner
- **THEN** the center SHALL not display that batch or its candidates
- **AND** it SHALL retain the governed recovery behavior.

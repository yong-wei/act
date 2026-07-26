## ADDED Requirements

### Requirement: AI-assisted detailed rubric authoring remains teacher-directed
The system SHALL provide an emphasized AI-fill action for an enabled detailed rubric and SHALL generate scoring guidelines for the complete current set of evaluation levels without changing the rubric structure.

#### Scenario: Scoring standard is available
- **WHEN** the teacher requests AI fill and the scoring item has a non-empty scoring standard
- **THEN** the system SHALL use that standard as the primary generation basis
- **AND** it SHALL generate one scoring guideline for every current evaluation-level identity.

#### Scenario: Scoring standard is missing
- **WHEN** the teacher requests AI fill and the scoring standard is empty
- **THEN** the system SHALL open a dialog that allows the teacher to add the scoring standard before generation or explicitly ignore the omission
- **AND** choosing to add it SHALL save it through the normal draft contract before generation continues.

#### Scenario: Teacher ignores the missing scoring standard
- **WHEN** the teacher explicitly continues without a scoring standard
- **THEN** the system SHALL use the scoring-item name as the generation basis
- **AND** it SHALL make that reduced basis clear before sending the request.

#### Scenario: No generation basis exists
- **WHEN** both the scoring standard and scoring-item name are empty
- **THEN** the system SHALL reject generation and identify the fields that can provide a valid basis.

#### Scenario: Existing level content would be replaced
- **WHEN** any evaluation level already contains a teacher-entered scoring guideline
- **THEN** the system SHALL warn that the operation replaces all level scoring guidelines and require explicit confirmation
- **AND** cancellation SHALL preserve every existing guideline without sending a generation request.

#### Scenario: Generated level set is incomplete or stale
- **WHEN** generated output omits, duplicates, or invents a level identity, violates field bounds, or targets a changed draft revision
- **THEN** the system SHALL reject the complete generated set
- **AND** it SHALL NOT partially replace the current level guidelines.

#### Scenario: Generated guidelines are accepted
- **WHEN** the complete output matches the current evaluation-level identities and draft revision
- **THEN** the system SHALL apply all generated scoring guidelines as ordinary editable draft values
- **AND** it SHALL NOT add, remove, rename, reorder, or rescore levels, change the general scoring standard, publish the assignment, or initiate grading.


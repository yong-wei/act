## MODIFIED Requirements

### Requirement: Assignments have durable identity and immutable publication revisions
The system SHALL persist assignments as first-class records with stable identity, teacher ownership, one mutable pre-publication draft, immutable published revisions, timestamps, and lifecycle state.

#### Scenario: Teacher saves and publishes one assignment
- **WHEN** an authorized teacher saves and publishes content within the same assignment editing task
- **THEN** every save, publication operation, and resulting revision SHALL remain bound to the same stable assignment identity
- **AND** repeated publication SHALL NOT create a second student-visible assignment identity.

#### Scenario: Teacher publishes a draft revision
- **WHEN** an authorized teacher publishes a valid draft whose current content is successfully saved, matches the teacher's current editor content, and has no version conflict
- **THEN** the system SHALL atomically create or return the immutable numbered published revision for that saved baseline
- **AND** the publication operation SHALL NOT perform an additional draft save.

#### Scenario: Teacher publishes while a local save is pending
- **WHEN** the current content is saving, save-failed, conflicted, or differs from the last successfully saved draft revision
- **THEN** publication SHALL remain unavailable and no published revision or audience SHALL be created
- **AND** the editor SHALL identify the save or conflict recovery action.

#### Scenario: Existing submission references an older revision
- **WHEN** a newer assignment revision is published after a student received or submitted an older revision
- **THEN** the student's assignment and grading records SHALL continue to reference the originally assigned immutable revision.

## ADDED Requirements

### Requirement: Assignment publication is idempotent and has one completion flow
Publication SHALL deduplicate equivalent requests for the same stable assignment identity and saved publication baseline and SHALL leave the editor through one successful completion flow.

#### Scenario: Equivalent publication request is repeated
- **WHEN** the same saved publication baseline is submitted more than once because of a double-click, network retry, or concurrent request
- **THEN** every request SHALL return the first successful publication result
- **AND** the system SHALL NOT create an additional published revision or audience set.

#### Scenario: Publication succeeds
- **WHEN** publication commits successfully
- **THEN** the client SHALL immediately return to the teacher assignment list
- **AND** the list SHALL show and locate the published assignment using its stable identity and teacher-visible class names rather than internal class identifiers.

### Requirement: Historical duplicate publications are repaired without losing lineage
The system SHALL provide an auditable and idempotent repair for historical duplicate published versions that preserves all student submission and grading lineage.

#### Scenario: Duplicate version has no dependent submission
- **WHEN** a historical duplicate published version has no student submission, grading review, or other retained dependent record
- **THEN** the repair MAY delete that duplicate version
- **AND** it SHALL record the affected stable assignment and version in the repair result.

#### Scenario: Duplicate version has dependent submissions
- **WHEN** a historical duplicate published version has any student submission or grading dependency
- **THEN** the repair SHALL preserve it as a read-only historical version
- **AND** it SHALL NOT break its submission, review, feedback, or audit associations.

#### Scenario: Repair selects current publication
- **WHEN** duplicate versions for one provable stable assignment have been classified
- **THEN** exactly one current published version SHALL enter the student assignment list
- **AND** ambiguous identity groups SHALL remain unchanged and be reported for manual resolution.

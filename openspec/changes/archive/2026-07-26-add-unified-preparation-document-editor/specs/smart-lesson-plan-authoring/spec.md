## ADDED Requirements

### Requirement: Lesson drafts and outlines open in the unified editor
Smart-preparation outline and lesson-draft editing SHALL use the preparation document editor and SHALL preserve task, draft, and approval identities.

#### Scenario: Teacher edits a paused outline
- **WHEN** generation is paused for outline confirmation and the teacher selects edit
- **THEN** the outline SHALL open in the unified editor
- **AND** saving SHALL update the same paused draft rather than creating an unrelated browser-prompt value.

#### Scenario: Teacher edits a generated lesson
- **WHEN** the teacher edits a generated lesson draft
- **THEN** the complete structured lesson SHALL open in the unified editor
- **AND** approval SHALL operate only on the subsequently saved and validated draft revision.

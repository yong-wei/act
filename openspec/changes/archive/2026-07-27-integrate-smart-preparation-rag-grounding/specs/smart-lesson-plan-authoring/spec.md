## ADDED Requirements

### Requirement: Knowledge points and goals receive governed source matching
The system SHALL attempt to match every teacher-entered or system-suggested knowledge point and goal to reliable evidence in the current preparation resource pack.

#### Scenario: One reliable match exists
- **WHEN** source matching finds one reliable source
- **THEN** the system SHALL attach that source automatically and SHALL NOT require the teacher to process that item before continuing
- **AND** the teacher SHALL still be able to inspect, replace, or remove the binding.

#### Scenario: Reliable matches are ambiguous
- **WHEN** multiple materially different reliable matches remain
- **THEN** the system SHALL ask the teacher to select or reject the candidates
- **AND** the stage SHALL remain incomplete until the ambiguity is resolved.

#### Scenario: No reliable source exists
- **WHEN** source matching finds no reliable source
- **THEN** the item SHALL remain marked as a source gap
- **AND** the stage SHALL complete only after the teacher explicitly confirms the gap and records a short reason.

#### Scenario: Confirmed source gap is displayed
- **WHEN** the teacher confirms a no-source gap and records a reason
- **THEN** the item SHALL remain displayed as `无可靠来源`
- **AND** it SHALL NOT be represented as verified or as having linked evidence.

#### Scenario: Teacher changes an attached source
- **WHEN** the teacher replaces or removes an automatically or manually attached source
- **THEN** the system SHALL persist the new binding or gap state and re-evaluate the affected stage
- **AND** generation SHALL use only the resulting teacher-visible source decision.

### Requirement: Source matching invalidates only on semantic change
The system SHALL preserve valid source decisions across presentation-only edits and SHALL re-evaluate them after semantic edits.

#### Scenario: Formatting-only edit is saved
- **WHEN** an edit changes only formatting, whitespace, or punctuation without changing normalized meaning
- **THEN** existing source bindings and gap confirmations SHALL remain valid.

#### Scenario: Semantic content is changed
- **WHEN** a knowledge point or goal changes meaning
- **THEN** its existing source decision SHALL become stale and source matching SHALL run again
- **AND** affected stage completion SHALL be removed until the new decision is valid.

### Requirement: Class adaptation reads the current cumulative class portrait
When a class is selected for smart preparation, generation SHALL read the current authorized cumulative class portrait rather than a historical diagnosis snapshot.

#### Scenario: Default class is available
- **WHEN** the teacher opens class selection and has an authorized default class
- **THEN** that class SHALL be selected initially and its current cumulative portrait summary SHALL be displayed
- **AND** the teacher SHALL be able to select another authorized class or choose not to use class learning state.

#### Scenario: Default class has no available cumulative portrait
- **WHEN** the authorized default class is selected but its cumulative portrait is unavailable
- **THEN** the UI SHALL show the governed unavailability reason
- **AND** the teacher SHALL still be able to continue with generic audience context, select another class, or choose not to use class learning state.

#### Scenario: Selected class portrait changes before generation
- **WHEN** generation reads the selected class
- **THEN** it SHALL use the current authoritative cumulative class-portrait projection rather than a historical diagnosis report or task snapshot
- **AND** it SHALL NOT require a frozen class-portrait version.

#### Scenario: The same selected class portrait changes during preparation
- **WHEN** new learner evidence updates the selected class's cumulative portrait while the task remains open
- **THEN** the system SHALL NOT create a task-specific portrait version, show a change warning, or mark existing content stale solely for that update
- **AND** the next generation operation SHALL read the latest available cumulative portrait.

#### Scenario: Class selection changes after content generation
- **WHEN** the teacher changes or removes the selected class after generated content exists
- **THEN** the affected generated content SHALL be retained and marked stale
- **AND** regeneration from the outline SHALL require teacher confirmation.

## MODIFIED Requirements

### Requirement: Knowledge points are teacher-controlled
The system SHALL let the teacher select, edit, merge, or manually create knowledge points before goal confirmation.

#### Scenario: System suggests knowledge points
- **WHEN** enabled usable course-basis versions or teacher-confirmed textbook ranges are available
- **THEN** the system MAY propose knowledge-point candidates from governed retrieval
- **AND** each candidate SHALL retain source bindings or an explicit source-gap state.

#### Scenario: Teacher edits suggested knowledge points
- **WHEN** a teacher selects, renames, or merges suggested candidates
- **THEN** the task SHALL record the resulting teacher-confirmed knowledge points and their lineage
- **AND** generation SHALL use the confirmed result rather than the original suggestions.

#### Scenario: Teacher creates a knowledge point manually
- **WHEN** a teacher enters a knowledge point that was not suggested
- **THEN** the system SHALL retain it as teacher-created
- **AND** it SHALL automatically attempt source matching before requiring teacher resolution of ambiguity or an explicit source gap.

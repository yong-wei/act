## MODIFIED Requirements

### Requirement: Teachers can manage assignments through an assignment workspace
The system SHALL provide authorized teachers with assignment list, create, edit, preview, save-draft, publish, and lifecycle management surfaces.

#### Scenario: Teacher opens assignment management
- **WHEN** a teacher opens `/teacher/assignments`
- **THEN** the page SHALL show assignments with draft, published, review, returned, completed, or closed state as applicable
- **AND** it SHALL expose class audience, schedule, submission totals when available, and the next valid action.

#### Scenario: Teacher edits an assignment
- **WHEN** a teacher opens a new or existing draft
- **THEN** the editor SHALL show assignment title and instructions once before the question editing region
- **AND** the left outline SHALL show `从题库选择`, `新建题目`, and the ordered current question list
- **AND** the main region SHALL expose the selected question prompt, reference answer, points, scoring criteria, optional detailed rubric, draft state, preview, publication settings, and publish controls.

#### Scenario: Teacher views question-bank metadata
- **WHEN** the assignment workspace displays source, question type, review state, version, or grading-readiness metadata
- **THEN** every supported value SHALL use a centralized Chinese label
- **AND** the page SHALL NOT expose raw internal enum values or identifiers.

## ADDED Requirements

### Requirement: Assignment scoring items use concise accordion summaries
The assignment workspace SHALL present each scoring item as an accordion whose collapsed and expanded states preserve the complete scoring-item identity.

#### Scenario: Scoring item is collapsed
- **WHEN** a scoring item accordion is collapsed
- **THEN** it SHALL show the item name, point value, move-up, move-down, and delete controls
- **AND** it SHALL hide the scoring standard and optional detailed rubric fields without discarding their values.

#### Scenario: Scoring item is expanded
- **WHEN** a teacher expands a scoring item
- **THEN** the workspace SHALL expose the scoring standard and the optional detailed-rubric controls for that same stable item.

### Requirement: Assignment workspace separates draft and publication validation
The workspace SHALL allow incomplete drafts to be saved while keeping field feedback, save state, and publication blockers visible and recoverable.

#### Scenario: Draft contains incomplete fields
- **WHEN** automatic or explicit draft saving encounters incomplete authoring content that is still valid as a draft
- **THEN** the draft SHALL remain saveable
- **AND** each issue SHALL remain at its field without moving the page or keyboard focus.

#### Scenario: Teacher requests publication with invalid fields
- **WHEN** the teacher selects publish and one or more publication conditions fail
- **THEN** the workspace SHALL remain at the current route and scroll context
- **AND** it SHALL provide a problem list whose actions expand and focus the corresponding question, scoring item, or publication field.

### Requirement: Publication settings remain summarized and recoverable
Publication settings SHALL appear in the assignment main region as a default-collapsed section with a teacher-readable summary.

#### Scenario: Publication settings are complete
- **WHEN** the settings section is collapsed
- **THEN** its summary SHALL show target class names, publication time, and due time
- **AND** it SHALL NOT show internal class identifiers or sequence numbers.

#### Scenario: Publication setting blocks publication
- **WHEN** a required setting is missing or invalid
- **THEN** the settings section SHALL expand automatically during publication validation
- **AND** the affected field SHALL show its issue in place.

### Requirement: Assignment workspace exposes save state and derived total
The assignment editor SHALL continuously expose the current save state and SHALL derive the assignment total from question point values.

#### Scenario: Draft save state changes
- **WHEN** the current draft is saving, saved, save-failed, or conflicted
- **THEN** the workspace SHALL show `正在保存`, `已保存`, `保存失败`, or `存在冲突` respectively
- **AND** publication availability SHALL consume the publication-baseline contract rather than infer readiness from elapsed time.

#### Scenario: Question points change
- **WHEN** a teacher adds, removes, or changes a question point value
- **THEN** the displayed assignment total SHALL update from the sum of all question values
- **AND** the workspace SHALL NOT expose a separate editable total field.

#### Scenario: Teacher types into a field with example text
- **WHEN** the teacher enters or pastes content
- **THEN** any example text SHALL behave only as a placeholder and disappear
- **AND** it SHALL NOT become part of the saved content.


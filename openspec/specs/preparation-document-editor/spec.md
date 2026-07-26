# preparation-document-editor Specification

## Purpose
TBD - created by archiving change add-unified-preparation-document-editor. Update Purpose after archive.
## Requirements
### Requirement: Preparation documents use one full-screen visual editor
The system SHALL provide one project-owned full-screen visual editor adapter for smart lesson documents, editable course-basis documents, and smart-courseware content.

#### Scenario: Teacher opens a preparation document
- **WHEN** the teacher chooses `编辑`
- **THEN** the editor SHALL show document title and save state at the top, structure navigation on the left, the editable document in the main region, and AI review suggestions on the right when available
- **AND** browser prompts, raw Markdown textareas, and raw JSON editors SHALL NOT be the primary editing interface.

#### Scenario: Document contains rich teaching content
- **WHEN** a document contains Markdown structure, tables, formulas, code blocks, or lists
- **THEN** the editor SHALL render and edit the supported content as one continuous document
- **AND** saving and reopening SHALL preserve the supported structure and meaning.

#### Scenario: Teacher exits after a successful save
- **WHEN** the teacher exits the editor after the current revision is saved
- **THEN** the system SHALL return to the originating task, accordion stage, expansion state, and scroll position.

#### Scenario: Editor renders on a narrow screen
- **WHEN** the editor renders where three columns cannot fit
- **THEN** the document SHALL remain the primary region and structure navigation and AI suggestions SHALL move to dismissible drawers
- **AND** save, exit, error state, keyboard focus, and accessible save status SHALL remain reachable without horizontal page scrolling.

### Requirement: Editor saves are durable and conflict-aware
The editor SHALL provide autosave and explicit save against an optimistic document revision and SHALL protect unsaved work.

#### Scenario: Autosave succeeds
- **WHEN** the teacher pauses after a valid content change
- **THEN** the editor SHALL save the change and show `保存中` followed by `已保存`.

#### Scenario: Explicit save succeeds
- **WHEN** the teacher selects `保存`
- **THEN** the current valid document SHALL be persisted before success is shown.

#### Scenario: Save fails or conflicts
- **WHEN** a save fails or the base revision is stale
- **THEN** the editor SHALL retain the local content, show the failure or conflict, and provide retry or reload-and-compare actions
- **AND** leaving the editor SHALL require confirmation while unsaved content remains.

### Requirement: Lesson structure remains governed during editing
The lesson editor SHALL preserve the six BOPPPS stages as fixed top-level sections while allowing teachers to edit their internal teaching steps.

#### Scenario: Teacher edits internal steps
- **WHEN** the teacher adds, removes, reorders, or edits steps inside a BOPPPS stage
- **THEN** the editor SHALL update the structured lesson draft
- **AND** all six top-level BOPPPS stages SHALL remain present and ordered.

#### Scenario: Edited timing is invalid
- **WHEN** stage or nested-step durations no longer satisfy the task duration contract
- **THEN** the editor SHALL show the affected validation errors
- **AND** approval SHALL remain unavailable until the document is valid.

#### Scenario: A required stage is incomplete
- **WHEN** a fixed BOPPPS stage lacks required content
- **THEN** the editor SHALL mark that stage incomplete in the document navigation
- **AND** lesson approval SHALL remain unavailable.

### Requirement: AI review suggestions remain advisory
AI review findings SHALL be positioned against the relevant document content and SHALL support individual accept and ignore actions without approving the document.

#### Scenario: Teacher accepts a suggestion
- **WHEN** the teacher accepts a positioned suggestion
- **THEN** the proposed change SHALL be applied as an ordinary teacher edit and saved through the normal revision contract
- **AND** the lesson SHALL remain unapproved until the teacher performs the explicit approval action.

#### Scenario: Teacher ignores a suggestion
- **WHEN** the teacher ignores a suggestion
- **THEN** its dismissed state SHALL be retained for the current document revision
- **AND** the underlying content SHALL remain unchanged.

### Requirement: Shared editor supports embedded assignment content
The project-owned document editor SHALL provide an embedded assignment mode for teacher-authored question prompts and reference answers and for student-authored response bodies, without requiring the full-screen preparation workspace.

#### Scenario: Teacher edits assignment content
- **WHEN** a teacher edits a question prompt or reference answer
- **THEN** the embedded editor SHALL accept Markdown and preview supported formulas and images
- **AND** it SHALL use the same content parsing, rendering, and protected asset insertion contracts as other project-owned document editing surfaces.

#### Scenario: Student edits a response body
- **WHEN** a student edits an assignment response body
- **THEN** the embedded editor SHALL support Markdown and image insertion through file selection, drag-and-drop, or paste
- **AND** each inserted image SHALL produce a stable protected asset reference for the assignment response contract.

#### Scenario: Embedded content is saved
- **WHEN** the host confirms that the current embedded value and its referenced assets were saved successfully
- **THEN** the field SHALL leave editing state and display the rendered result
- **AND** the rendered result SHALL preserve supported Markdown structure, formulas, and images.

#### Scenario: Embedded content save fails or conflicts
- **WHEN** the host reports a save failure or revision conflict
- **THEN** the embedded editor SHALL retain the local value and remain available for retry or conflict recovery
- **AND** it SHALL NOT replace the local value with a stale rendered result.

#### Scenario: Assignment page uses the embedded mode
- **WHEN** the shared editor renders inside an assignment authoring or response page
- **THEN** it SHALL omit full-screen structure navigation, preparation-document AI review, and BOPPPS governance regions
- **AND** assignment validation, publication, grading, and submission behavior SHALL remain owned by the host assignment workflow.


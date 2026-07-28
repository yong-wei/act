## ADDED Requirements

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


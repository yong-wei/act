## ADDED Requirements

### Requirement: Editable course-basis documents use the unified editor
Course-basis documents that are eligible for teacher editing SHALL open in the preparation document editor.

#### Scenario: Editable version is changed
- **WHEN** the teacher edits a document version that has not been frozen by first use
- **THEN** saving SHALL update that mutable version through its revision contract.

#### Scenario: Frozen version is edited
- **WHEN** the teacher requests an edit to a frozen document version
- **THEN** the editor SHALL create and open a new mutable version
- **AND** the frozen version, anchors, citations, and content hash SHALL remain unchanged.

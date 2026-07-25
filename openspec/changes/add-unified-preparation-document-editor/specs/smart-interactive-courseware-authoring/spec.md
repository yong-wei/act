## ADDED Requirements

### Requirement: Smart courseware reuses the preparation document editor
Smart-courseware editing SHALL consume the same project-owned preparation editor adapter used by lesson and course-basis documents while retaining courseware-owned structure, validation, preview, and publication semantics.

#### Scenario: Teacher edits generated courseware content
- **WHEN** the teacher opens editable content from a generated smart-courseware draft
- **THEN** the content SHALL open through the unified full-screen editor and return to the originating preparation stage after save and exit
- **AND** the courseware domain SHALL remain responsible for its manifest, module identity, validation, preview, approval, and publication rules.

#### Scenario: Courseware edit is incomplete
- **WHEN** an edit makes required courseware content incomplete or invalid
- **THEN** the editor SHALL show the affected incomplete state
- **AND** the courseware SHALL not become approvable or publishable until courseware-domain validation succeeds.

## ADDED Requirements

### Requirement: Standard modules use commercial module chrome
Canonical interactive course modules SHALL render through a commercial module chrome that standardizes title, prompt, activity state, answer state, feedback state, teacher release state, and evidence markers.

#### Scenario: Migrated lesson module renders
- **WHEN** a migrated interactive lesson renders a canonical module such as explanation, reveal, quiz, sort, match, workspace, compute panel, or reflection
- **THEN** the module SHALL use the shared commercial module chrome for state, controls, feedback, and evidence
- **AND** lesson-private visual variants SHALL NOT be used to create one-off module skins.

### Requirement: Course runtime keeps content and platform visual system decoupled
Interactive course content SHALL declare content, activity type, response contract, and capability references, while platform runtime owns commercial module presentation.

#### Scenario: A new course manifest is reviewed
- **WHEN** a course manifest introduces a module
- **THEN** the manifest SHALL reference registered module classes and content fields
- **AND** it SHALL NOT embed page-local styling, private component variants, or unregistered visual skins as course content.

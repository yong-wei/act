## ADDED Requirements

### Requirement: Authoring resource actions shall form executable flow
Resource preview, knowledge-node selection, playlist creation, and course-flow play routes SHALL preserve authoring context and expose executable next actions.

#### Scenario: a teacher previews a resource or knowledge node during authoring
- **WHEN** a teacher previews a resource or knowledge node during authoring
- **THEN** the surface SHALL offer valid actions such as add to lesson stage, add to course flow, open ResourceNode governance, or recover missing context.

#### Scenario: a playlist or course flow is saved or opened
- **WHEN** a playlist or course flow is saved or opened
- **THEN** the selected nodes SHALL persist, the play route SHALL preserve intent, and missing objects SHALL render product recovery states.

### Requirement: Knowledge authoring mobile and accessibility states shall be usable
Knowledge graph, course-flow builder, and ResourceNode management SHALL provide accessible tool names, scalable selection, and mobile step structure.

#### Scenario: a user navigates graph layout tools, add/remove/reorder controls, or builder actions by keyboard or screen reader
- **WHEN** a user navigates graph layout tools, add/remove/reorder controls, or builder actions by keyboard or screen reader
- **THEN** every control SHALL have a stable accessible name and state.

#### Scenario: the builder is opened on mobile
- **WHEN** the builder is opened on mobile
- **THEN** the flow SHALL use progressive steps or compact panels instead of one long dense desktop editor.

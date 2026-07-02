## Purpose
Audit remediation contract for lesson authoring, resource governance, playlists, course flows, and knowledge-node task states.
## Requirements
### Requirement: Authoring actions must preserve task intent
The system SHALL preserve create, edit, clone, preview, use, play, start-class, and quality-report intent across audited authoring and resource routes.

#### Scenario: Lesson edit deep link opens edit context
- **WHEN** a teacher or administrator opens an audited lesson edit link
- **THEN** the page opens the intended edit context or a missing-object recovery state, not a generic long list

#### Scenario: Playlist play link preserves play intent
- **WHEN** a playlist direct play URL is opened
- **THEN** the user sees the intended play state or an explicit unavailable-play recovery state

### Requirement: Large authoring lists must be actionable
The system SHALL provide search, filtering, pagination, no-match, preview, selected-state summary, and recovery actions for audited ResourceNode, knowledge-node, lesson-plan, and course-flow lists.

#### Scenario: Course-flow builder handles large knowledge catalog
- **WHEN** a teacher builds a course flow from a large knowledge-node catalog
- **THEN** the UI supports finding, selecting, previewing, and saving nodes without exposing an unbounded 820-item list as the primary workflow

### Requirement: Authoring/resource remediation must update audit findings
The system SHALL update audit report findings after authoring, resource, playlist, and course-flow remediation is verified.

#### Scenario: Authoring finding is closed
- **WHEN** an audited authoring or resource flow is fixed
- **THEN** the report entry links the fixed route, new evidence, and change id

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

### Requirement: Authoring API data shall be consumed as tasks
Authoring UI surfaces that consume lesson plan, resource, ResourceNode, or knowledge-node APIs SHALL organize returned data into actionable tasks rather than inert long lists.

#### Scenario: authoring API data is available
- **WHEN** lesson plan, resource, ResourceNode, or knowledge-node APIs return records
- **THEN** the UI SHALL expose object-appropriate tasks such as edit, validate, preview, attach, inspect usage, resolve blocked state, cite, save, or archive.
- **AND** each task SHALL show whether it is available, disabled with reason, pending, saved, failed, rolled back, or not reversible.

#### Scenario: an authoring task cannot be executed
- **WHEN** a task is unavailable because of missing metadata, invalid reference, blocked ResourceNode state, permission, or unsupported rollback
- **THEN** the UI SHALL explain the reason and provide the nearest recovery action when one exists.

### Requirement: Authoring API task closure shall avoid archived flow scope
Authoring API-consumption findings SHALL be closed only for taskized API-backed lesson plan, resource, ResourceNode, and knowledge-node behavior.

#### Scenario: audit report is updated
- **WHEN** this change updates the Product Design audit report
- **THEN** every closed finding id SHALL reference API-consumption task evidence and SHALL NOT re-close playlist save/play, graph filter, mobile builder, or button-name scope covered by `audit-remediation-authoring-knowledge-flow-polish`.


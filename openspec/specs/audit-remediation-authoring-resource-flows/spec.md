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


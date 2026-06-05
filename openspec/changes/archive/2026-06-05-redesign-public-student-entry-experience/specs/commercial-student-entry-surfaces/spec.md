## ADDED Requirements

### Requirement: Student entry pages prioritize learning intent over module directories
Student entry pages SHALL organize primary actions by learning intent rather than implementation module names.

#### Scenario: Student opens an entry page
- **WHEN** homepage, Interactive Learning, course catalog, simulation hub, Arena, or adaptive practice entry renders
- **THEN** the first viewport SHALL make the primary student task visible through learn, practice, challenge, experiment, or review/account intent
- **AND** implementation-oriented destinations such as component libraries SHALL NOT compete as equal primary paths.

### Requirement: Student entry prioritizes current learning work when available
Student entry pages SHALL prioritize current learning work before generic route directories.

#### Scenario: Student has active learning context
- **WHEN** a student has current class, current lesson/session, active assignment, next practice, Arena task, or experiment context
- **THEN** the entry surface SHALL show the current path and next action before generic module lists
- **AND** the UI SHALL not require the student to infer the next task from equal-weight cards.

### Requirement: Mobile entry surfaces are task-first
Student entry pages SHALL provide task-first mobile layouts.

#### Scenario: Entry page renders at 320px width
- **WHEN** a student-visible entry page renders on mobile
- **THEN** it SHALL show one primary task and at most one secondary task in the first viewport
- **AND** long feature matrices SHALL collapse into drawer, carousel, tab, or secondary sections.

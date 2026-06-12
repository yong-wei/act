## Purpose

Define the commercial student entry surface system across public, authenticated,
learning, practice, challenge, experiment, review, and account/profile routes.
## Requirements
### Requirement: Student entry surfaces form a commercial product map
The system SHALL render homepage, student cockpit, Interactive Learning, Arena, adaptive learning, and profile entry surfaces as one coherent commercial product map organized by learning intent.

#### Scenario: Student opens a primary entry surface
- **WHEN** a student opens `/`, `/dashboard`, `/interactive-learning`, `/arena`, `/assessment/adaptive-practice`, or `/profile`
- **THEN** the surface SHALL preserve access to the relevant learn, practice, challenge, experiment, review, and account/profile intents
- **AND** the visual hierarchy SHALL identify the current product context without presenting all destinations as unrelated equal cards.

### Requirement: Student entry redesign may replace unreasonable legacy layouts
The system SHALL allow legacy student entry layouts, local headers, local palettes, and card-heavy grouping structures to be replaced when they conflict with commercial brand, navigation, or responsive requirements.

#### Scenario: A legacy entry layout conflicts with the commercial model
- **WHEN** an existing entry page relies on duplicated shell navigation, page-local color systems, oversized decorative hero blocks, or unrelated card matrices
- **THEN** the migration MAY replace that layout with a commercial entry surface
- **AND** existing route access, role access, and primary task entry SHALL remain functional.

### Requirement: Student entry surfaces show complete navigable states
The system SHALL render empty, loading, unauthenticated, authenticated, low-evidence, disabled, and feature-flagged states as complete navigable commercial states.

#### Scenario: Adaptive practice has no immediately available questions
- **WHEN** a student enters adaptive practice from homepage, cockpit, profile, or another route and no question list is immediately available
- **THEN** the surface SHALL show the current loading, empty, fallback, or evidence-limited reason
- **AND** it SHALL keep navigation to learner state, practice retry, Interactive Learning, Arena, and profile/review paths available.

### Requirement: Commercial entry surfaces keep first-viewport tasks visible
The system SHALL ensure student entry pages reveal usable destinations or repeated content in the first viewport across desktop and mobile.

#### Scenario: Student opens a product entry page
- **WHEN** a student opens homepage, Interactive Learning, Arena, or adaptive learning on a normal desktop or mobile viewport
- **THEN** primary destinations or first repeated items SHALL be visible without scrolling past a purely decorative hero
- **AND** visual branding SHALL support the task hierarchy rather than replace it.

### Requirement: Student entry summaries consume governed evidence
The system SHALL render progress, recommendations, readiness, and evidence summaries through feature-owned data and shared status semantics.

#### Scenario: A recommendation or readiness summary is shown
- **WHEN** a student entry surface displays personalized guidance, mastery state, Arena readiness, or course progress
- **THEN** the surface SHALL show confidence or missing-evidence context when available
- **AND** it SHALL NOT derive learner-state truth inside page-local presentation components.

### Requirement: Authentication surfaces are commercial entry surfaces
The system SHALL render login, authentication callback, authentication error, account menu, and profile callback routes as part of the commercial entry surface system.

#### Scenario: Student opens login with profile callback
- **WHEN** a student opens `/login?callbackUrl=%2Fprofile`
- **THEN** the surface SHALL preserve the profile destination intent
- **AND** it SHALL use the commercial brand, navigation, account/profile semantics, loading state, and error state rules
- **AND** it SHALL NOT appear as a visually disconnected technical form.

#### Scenario: Authentication fails or is incomplete
- **WHEN** login, session restoration, or profile callback cannot complete
- **THEN** the surface SHALL show a branded, actionable error or fallback state
- **AND** it SHALL preserve navigation to safe product entry routes without losing the intended callback.

### Requirement: Public and learning entries use one premium map
The system SHALL render homepage, login, Interactive Learning, course catalog, course entry, and simulation hub as one coherent premium entry family.

#### Scenario: Student moves from homepage to learning entry
- **WHEN** a student opens homepage, Interactive Learning, course catalog, or simulation hub
- **THEN** the visible hierarchy SHALL preserve the same brand language, intent grouping, route frame, theme behavior, and cockpit/account semantics
- **AND** Interactive Learning and course catalog SHALL use the unified AppShell or approved shell resolved from route inventory
- **AND** the page SHALL NOT fall back to unrelated generic card-grid styling or page-local topbar navigation.

### Requirement: Course and simulation entries show structured learning intent
The system SHALL organize course and simulation entry surfaces by module, scenario, progression, status, and recommended action where data is available.

#### Scenario: Course catalog renders
- **WHEN** the course catalog displays modules or lessons
- **THEN** it SHALL expose module progression, course type, launch action, and learning intent through a coherent map or path layout
- **AND** repeated cards MAY be used only for actual repeated course items.

#### Scenario: Simulation hub renders
- **WHEN** the simulation hub displays ship scenarios
- **THEN** existing ship imagery SHALL be treated as primary scenario identity
- **AND** difficulty, course fit, task status, and launch actions SHALL use shared entry and status semantics.

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

### Requirement: Learner surfaces converge on learning atlas and knowledge-data map shells
Student dashboard, profile, growth, evidence, adaptive practice, knowledge, and data surfaces SHALL use unified shell archetypes for navigation, evidence, and next action behavior.

#### Scenario: Learner surface renders
- **WHEN** a student opens dashboard, profile, growth, evidence, adaptive practice, knowledge graph, or data center routes
- **THEN** the route SHALL use route-ledger archetype metadata to render learning-atlas or knowledge-data-map shell behavior
- **AND** the page SHALL preserve account/profile, cockpit, evidence, and adjacent learning navigation without page-local competing headers.

#### Scenario: Adaptive practice opens from different entries
- **WHEN** adaptive practice is opened from homepage, cockpit, profile, or another student entry
- **THEN** the surface SHALL display a complete loading, item, empty, low-evidence, or fallback state
- **AND** the state SHALL keep navigation to learner record, retry, Interactive Learning, Arena, and profile/review paths available.

### Requirement: Learner surfaces prepare path explanation slots
Student learner surfaces SHALL reserve governed shell slots for future path bundle explanation and selection history.

#### Scenario: Path bundle capability is available
- **WHEN** three-style learning path options or selection history are available
- **THEN** the migrated learner shell SHALL display options, evidence basis, confidence, limitations, and cited explanation in shared status and evidence semantics
- **AND** UI components SHALL not fabricate path or mastery truth from presentation state.

### Requirement: Interactive Learning first-hop destinations keep the entry shell
Interactive Learning first-hop student destinations SHALL remain in the same learning-atlas navigation family as the entry page.

#### Scenario: Student follows an Interactive Learning entry action
- **WHEN** a student opens chapter components or cross-domain exploration from the Interactive Learning entry page
- **THEN** the destination SHALL preserve learning-atlas shell behavior, route trace, and adjacent learning navigation
- **AND** the destination SHALL NOT fall back to page-local topbar navigation unless the route ledger records a narrow active exception.


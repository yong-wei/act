## ADDED Requirements

### Requirement: Adaptive path generation uses an editable task panel
The adaptive learning center SHALL open path generation in a focused editable task panel rather than presenting static page summaries as controls.

#### Scenario: Student opens generation
- **WHEN** a student activates `生成学习路径`, `请控灵调整`, or an empty-state generation action
- **THEN** the page SHALL open a desktop panel or mobile sheet for path generation
- **AND** the panel SHALL contain editable controls for learning goal, available time, difficulty rhythm, resource preferences, checkpoint density, external-resource permission, and natural-language intent.

#### Scenario: Student edits generation parameters
- **WHEN** the student changes any generation parameter
- **THEN** the generated request SHALL use the edited value
- **AND** the UI SHALL NOT require JSON, internal field names, or global chat input to modify path parameters.

### Requirement: Generated path options are selectable and comparable
The adaptive learning center SHALL display generated path options as comparable, actionable route choices.

#### Scenario: Options are shown after generation
- **WHEN** generation succeeds
- **THEN** the UI SHALL show three comparable path options when distinct active, preparation, or locked-route structures are available
- **AND** each option SHALL show estimated duration, resource mix, current recommendation reason, readiness state, checkpoints, unlockable heavy nodes, expected result, and risk note.

#### Scenario: Student chooses an option
- **WHEN** the student selects, asks Konling to adjust, rejects, or asks why an option was recommended
- **THEN** the action SHALL be recorded through governed path activity
- **AND** the UI SHALL preserve other options as alternatives until a later recalculation or explicit dismissal.

### Requirement: Generation panel follows Product Design visual contract
The generation panel and comparison view SHALL be accepted against the Product Design visual sources.

#### Scenario: Visual QA is performed
- **WHEN** this change is implemented
- **THEN** QA evidence SHALL cite `artifacts/product-design-audits/adaptive-learning-path-2026-06-14/design-handoff.md`
- **AND** it SHALL compare screenshots against `01-path-generation-main.png` and `02-path-selection-comparison.png`
- **AND** it SHALL cite current-state screenshots from `artifacts/product-design-audits/adaptive-learning-path-2026-06-16-current-audit/`.

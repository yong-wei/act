## ADDED Requirements

### Requirement: Canonical module classes are finite
The system SHALL define a finite canonical module taxonomy for manifest-driven interactive lessons.

#### Scenario: Canonical classes are registered
- **WHEN** a manifest module is authored for a new or migrated lesson
- **THEN** its module class SHALL be one of `content.rich`, `content.cardSet`, `content.formula`, `content.table`, `content.figure`, `content.reveal`, `content.stageMap`, `activity.panel`, `activity.workspace`, `compute.panel`, `analytics.summary`, `layout.support`, or `legacy.adapter`
- **AND** `legacy.adapter` SHALL be marked migration-only.

### Requirement: Module kind does not encode orthogonal concerns
The module taxonomy SHALL keep presentation, course semantics, interaction behavior, response structure, and compute capability binding outside the canonical module class name.

#### Scenario: Presentation is a field
- **WHEN** a module needs row, grid, strip, column, tabs, or panel presentation
- **THEN** that choice SHALL be represented as a presentation field or renderer option
- **AND** it SHALL NOT create a new module class such as `summary-card-row`, `formula-strip`, or `step-reveal-column`.

#### Scenario: Course semantics are a field
- **WHEN** a module carries semantics such as goal, risk, term, bridge, teacher note, reference answer, or misconception
- **THEN** that meaning SHALL be represented as a semantic role field
- **AND** it SHALL NOT create a course-specific module class.

#### Scenario: Answer structure is a response contract
- **WHEN** an activity collects single choice, multi-select, ordering, matching, text, structured, parameter, or table answers
- **THEN** that structure SHALL be represented by the activity response contract
- **AND** it SHALL NOT create a module class such as `choice-check` or `scenario-sort-matrix`.

### Requirement: Legacy aliases are explicit and temporary
The system SHALL map historical `module.kind` values through an explicit alias table during migration.

#### Scenario: Legacy kind resolves through alias map
- **WHEN** a legacy manifest still contains a historical module kind
- **THEN** the runtime or migration tooling SHALL resolve it through a central alias map to a canonical module class
- **AND** the alias entry SHALL identify the replacement fields needed for equivalent rendering.

#### Scenario: New authoring rejects legacy aliases
- **WHEN** a new lesson or migrated manifest is validated
- **THEN** it SHALL use canonical module classes directly
- **AND** it SHALL NOT pass validation by relying on a legacy alias.

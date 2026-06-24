## MODIFIED Requirements

### Requirement: Canonical module classes are finite
The system SHALL define a finite canonical module taxonomy for manifest-driven interactive lessons.

#### Scenario: Canonical classes are registered
- **WHEN** a manifest module is authored for a new or migrated lesson
- **THEN** its module class SHALL be one of `content.rich`, `content.cardSet`, `content.formula`, `content.table`, `content.figure`, `content.code`, `content.reveal`, `content.stageMap`, `activity.panel`, `activity.workspace`, `compute.panel`, `analytics.summary`, `layout.support`, or `legacy.adapter`
- **AND** `legacy.adapter` SHALL be marked migration-only.

### Requirement: Module kind does not encode orthogonal concerns
The module taxonomy SHALL keep presentation, course semantics, interaction behavior, response structure, compute capability binding, and programming language outside the canonical module class name.

#### Scenario: Presentation is a field
- **WHEN** a module needs row, grid, strip, column, tabs, or panel presentation
- **THEN** that choice SHALL be represented as a presentation field or renderer option
- **AND** it SHALL NOT create a new module class such as `summary-card-row`, `formula-strip`, or `step-reveal-column`.

#### Scenario: Course semantics are a field
- **WHEN** a module carries semantics such as goal, risk, term, bridge, teacher note, reference answer, misconception, or code purpose
- **THEN** that meaning SHALL be represented as a semantic role field
- **AND** it SHALL NOT create a course-specific module class.

#### Scenario: Answer structure is a response contract
- **WHEN** an activity collects single choice, multi-select, ordering, matching, text, structured, parameter, table answers, or code-edit responses
- **THEN** that structure SHALL be represented by the activity response contract
- **AND** it SHALL NOT create a module class such as `choice-check` or `scenario-sort-matrix`.

#### Scenario: Programming language is a field
- **WHEN** a lesson displays MATLAB, Python, C, or other source code as teaching content
- **THEN** the module class SHALL remain `content.code`
- **AND** the language SHALL be represented by a payload language field, not by a class such as `matlab-code`.

### Requirement: Canonical modules are registry-backed
The system SHALL provide a registry that defines each canonical interactive module class and the metadata needed to validate and render it.

#### Scenario: Registry entry describes module behavior
- **WHEN** a canonical module class is registered
- **THEN** the entry SHALL identify its class, renderer or activity-slot behavior, allowed configuration shape, evidence-producing status, and authoring availability
- **AND** the entry SHALL be usable by validation code without importing lesson-private components.

#### Scenario: Code module is content-only
- **WHEN** `content.code` is registered
- **THEN** the registry SHALL mark it as a content module that does not produce learner evidence
- **AND** it SHALL require auditable code payload fields such as language and source text.

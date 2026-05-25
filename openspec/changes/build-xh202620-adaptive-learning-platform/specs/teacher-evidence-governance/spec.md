## MODIFIED Requirements

### Requirement: Teacher class insights include evidence coverage
Teacher class insight APIs SHALL expose evidence state, feature cache coverage, ResourceNode mapping coverage, path status coverage, intervention outcome coverage, and prerequisite-provided simulation/Arena evidence readiness for enrolled students.

#### Scenario: Class coverage summary is returned
- **WHEN** a teacher opens a class insight page
- **THEN** the response includes ready, stale, missing, and low-confidence evidence counts
- **AND** it includes ResourceNode mapping coverage, path plan adoption coverage, path deviation counts, and intervention outcome coverage where those features are enabled.

#### Scenario: Simulation coverage summary is returned
- **WHEN** a teacher opens a class insight page with course-launched simulation or Arena activity
- **THEN** the response SHALL include simulation/Arena source coverage, completion coverage, weak metric distribution, preview versus official provenance, and replay confidence coverage for students in that teacher's scope
- **AND** it SHALL preserve low-confidence reasons produced by prerequisite simulation/Arena feature materialization.

### Requirement: Teacher student insight includes traceable evidence drawer data
Teacher student insight APIs SHALL expose scoped recent evidence summaries for diagnosis drilldown, including simulation/Arena trace references and summary metrics where authorized.

#### Scenario: Recent evidence is scoped and summarized
- **WHEN** a teacher opens a student they teach
- **THEN** the response includes recent LearningFacts, durable submission summaries, session quality, and feature cache confidence without full raw logs.

#### Scenario: Path evidence is scoped and summarized
- **WHEN** a teacher inspects a student's adaptive path
- **THEN** the response SHALL include current path status, node completion, deviations, correction attempts, explanations, and evidence confidence
- **AND** it SHALL NOT expose private Konling dialogue text, hidden official Arena evaluation internals, or protected raw answer bodies.

#### Scenario: Simulation drilldown is scoped
- **WHEN** a teacher opens simulation or Arena evidence drilldown for a student they teach
- **THEN** the response SHALL include authorized trace references, summary metrics, source provenance, replay confidence, and low-confidence reasons
- **AND** it SHALL NOT leak hidden official evaluation internals, private student dialogue, protected raw answer bodies, or raw high-frequency trace payloads.

### Requirement: Teacher governance surfaces ResourceNode quality
Teacher-facing governance SHALL identify resources that are unavailable, unmapped, low confidence, or not eligible for adaptive paths.

#### Scenario: Teacher opens resource governance summary
- **WHEN** a teacher opens the resource management or class insight governance summary
- **THEN** the system SHALL show counts and examples of ResourceNodes missing knowledge mapping, prerequisites, renderer/launcher binding, evidence instrumentation, or policy metadata
- **AND** it SHALL distinguish system-owned issues from teacher-editable issues.

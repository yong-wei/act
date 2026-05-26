## MODIFIED Requirements

### Requirement: Teacher class insights include evidence coverage
Teacher class insight APIs SHALL expose evidence state and feature cache coverage for enrolled students, including simulation and Arena evidence readiness, weak metric summaries, and replay confidence coverage.

#### Scenario: Class coverage summary is returned
- **WHEN** a teacher opens a class insight page
- **THEN** the response includes ready, stale, missing, and low-confidence evidence counts

#### Scenario: Simulation coverage summary is returned
- **WHEN** a teacher opens a class insight page with course-launched simulation or Arena activity
- **THEN** the response SHALL include simulation/Arena source coverage, completion coverage, weak metric distribution, and replay confidence coverage for students in that teacher's scope

### Requirement: Teacher student insight includes traceable evidence drawer data
Teacher student insight APIs SHALL expose scoped recent evidence summaries for diagnosis drilldown, including simulation/Arena trace references and summary metrics where authorized.

#### Scenario: Recent evidence is scoped and summarized
- **WHEN** a teacher opens a student they teach
- **THEN** the response includes recent LearningFacts, durable submission summaries, session quality, and feature cache confidence without full raw logs

#### Scenario: Simulation drilldown is scoped
- **WHEN** a teacher opens simulation or Arena evidence drilldown for a student they teach
- **THEN** the response SHALL include authorized trace references, summary metrics, source provenance, replay confidence, and low-confidence reasons without leaking hidden official evaluation internals or raw high-frequency trace payloads

## Purpose
Expose teacher-facing data governance evidence without leaking raw or cross-class evidence.
## Requirements
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

### Requirement: Teacher insights include simulation-agent evidence summaries
Teacher class and student insight APIs SHALL expose scoped summaries for materialized simulation, Arena preview, and Konling agent evidence where authorized.

#### Scenario: Teacher opens class summary
- **WHEN** a teacher opens a class insight view
- **THEN** the response SHALL include authorized simulation-agent coverage, run completion, replay confidence, weak metric distribution, intervention outcome, and low-confidence counts for students in that class.

#### Scenario: Teacher opens student drilldown
- **WHEN** a teacher opens an authorized student drilldown
- **THEN** the response SHALL include scoped LearningFacts, evidence draft status, SimulationRun references, AgentToolRun references, summary metrics, and provenance markers
- **AND** it SHALL NOT expose raw high-frequency traces, hidden official evaluation internals, or raw private Konling memory by default.

### Requirement: Teacher summaries do not cross class scope
Teacher insight services SHALL prevent simulation-agent evidence from other classes or unrelated students from entering class-level summaries.

#### Scenario: Same simulation task exists in another class
- **WHEN** another class has runs for the same simulation task or Arena challenge
- **THEN** the teacher's class summary SHALL exclude those runs unless the teacher is authorized for that class.

### Requirement: Teacher reports expose control-correction path outcomes
Teacher-facing report APIs SHALL expose scoped control-correction path outcome metrics for authorized classes.

#### Scenario: Teacher opens the control-correction report
- **WHEN** an authorized teacher opens a class report for `goal=control-correction`
- **THEN** the response SHALL include path adoption, path completion, deviation, competency lift, simulation pass rate, Arena valid submission rate, Konling intervention acceptance, intervention-after-success, citation coverage, and resource contribution metrics
- **AND** each metric SHALL include denominator, included population, excluded population or reason, calculation window, confidence, and source coverage metadata.

#### Scenario: Teacher drills into a student
- **WHEN** an authorized teacher opens a student drilldown from the control-correction report
- **THEN** the response SHALL include scoped learner-state, path execution, terminal validation, intervention, and evidence summaries for that student
- **AND** it SHALL NOT expose raw answer bodies, raw private Konling memory, hidden Arena internals, or raw high-frequency traces by default.

#### Scenario: Teacher requests export
- **WHEN** an authorized teacher exports the control-correction report
- **THEN** the export SHALL include report metrics, chart-ready data, methodology notes, confidence markers, and redaction policy notes
- **AND** it SHALL preserve the same class-scope authorization as the report API.

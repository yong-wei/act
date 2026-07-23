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

### Requirement: Teacher attainment views default to cumulative scope
Teacher class insight and heatmap APIs SHALL accept `scope=cumulative|recent`
and SHALL use `cumulative` when scope is omitted. They SHALL preserve existing
class authorization for both scopes.

#### Scenario: Teacher opens an attainment view without scope
- **WHEN** an authorized teacher requests class insights or heatmap without a
  scope query parameter
- **THEN** the API SHALL return cumulative attainment based on the separately
  versioned cumulative class snapshot and current native portraits.

#### Scenario: Teacher explicitly requests recent scope
- **WHEN** an authorized teacher requests `scope=recent`
- **THEN** the API SHALL retain the existing recent evidence window and its
  activity, risk, classroom-quality, and trend semantics.

### Requirement: Cumulative teacher views distinguish attainment from recent signals
Teacher pages and API payloads SHALL label cumulative capability results as
"累计能力达成" and SHALL not manufacture a near-stage change for that scope.

#### Scenario: Cumulative heatmap is shown
- **WHEN** a teacher views the cumulative heatmap
- **THEN** it SHALL show all-history capability values and coverage state
- **AND** it SHALL represent near-stage change as not applicable.

#### Scenario: Recent indicators accompany cumulative attainment
- **WHEN** a cumulative class insight includes risk, classroom-quality, or
  activity indicators
- **THEN** those fields SHALL be explicitly not applicable in the cumulative
  API payload and their risk or spotlight conclusions SHALL be hidden
- **AND** the page SHALL direct the teacher to switch to recent scope for
  recent risk, classroom quality, activity, and trend conclusions.

### Requirement: Teacher student detail preserves cumulative attainment
An authorized teacher student detail SHALL use the learner's latest valid
native portrait v2 as its primary capability result. It SHALL keep recent
class-scoped facts limited to diagnostic evidence, activity, and risk
semantics; lack of recent scoped facts SHALL NOT suppress a valid cumulative
portrait.

#### Scenario: Completed-course learner opens in teacher detail
- **WHEN** an authorized teacher opens a learner with a valid native portrait
  v2 and no recent evidence scoped to the current class
- **THEN** the response includes that cumulative portrait and its generated
  timestamp as the primary capability result
- **AND** the recent diagnostic evidence state remains explicitly empty.

#### Scenario: Learner has no valid native portrait
- **WHEN** an authorized teacher opens a learner without a valid native
  portrait v2
- **THEN** the response SHALL remain an explicit no-evidence result
- **AND** it SHALL NOT fabricate a zero-valued or compatibility-derived
  cumulative portrait.

#### Scenario: Revoked evidence suppresses an older portrait
- **WHEN** the latest learner snapshot records
  `no-evidence-after-revocation` and an older native portrait v2 remains in
  storage
- **THEN** the response SHALL remain an explicit no-evidence result
- **AND** it SHALL NOT expose the revoked portrait as current cumulative
  attainment.

### Requirement: Teacher class comparisons preserve missing cumulative values
Teacher student details SHALL calculate a class comparison only when the
learner dimension has evidence and the cumulative class aggregate supplies a
finite mean for that dimension. Missing values SHALL NOT be represented as
zero scores, zero class means, or leading/lagging conclusions.

#### Scenario: A cumulative class mean is missing
- **WHEN** a learner has a cumulative portrait dimension but the cumulative
  class snapshot has no mean for that dimension
- **THEN** the student score, class mean, and gap for that comparison SHALL be
  unavailable
- **AND** the teacher view SHALL NOT report the learner as ahead or behind.

### Requirement: Cumulative class insights avoid recent compatibility projection
The cumulative teacher class-insights route SHALL select its native portrait
summaries without constructing recent class-scoped compatibility portraits.

#### Scenario: Cumulative request includes current scoped facts
- **WHEN** an authorized teacher requests cumulative class insights for a
  class that has current scoped LearningFacts
- **THEN** the request SHALL return its cumulative class response
- **AND** recent compatibility timestamp validation SHALL NOT affect that
  response.

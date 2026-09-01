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

### Requirement: Teacher student detail preserves cumulative attainment
An authorized teacher student detail SHALL use the learner's latest valid
canonical cumulative portrait as its only primary capability result. Activity,
trend, risk, diagnosis, and growth summaries SHALL be derived from the same
cumulative evidence contract and SHALL preserve current-member authorization.

#### Scenario: Learner has no newer evidence
- **WHEN** an authorized teacher opens a current member with a valid cumulative portrait and no newer eligible evidence
- **THEN** the response SHALL include that portrait, last evidence-triggered trend and risk, growth summary, and evidence cutoff
- **AND** it SHALL NOT create an empty calendar-window diagnosis or compatibility portrait.

#### Scenario: Learner has no valid cumulative portrait
- **WHEN** an authorized teacher opens a current member without a valid cumulative portrait
- **THEN** the response SHALL remain an explicit no-eligible-evidence result
- **AND** it SHALL NOT fabricate a zero-valued or compatibility-derived cumulative portrait.

#### Scenario: Revoked evidence suppresses an older portrait
- **WHEN** the latest learner state records `no-evidence-after-revocation` and an older portrait remains in storage
- **THEN** the response SHALL remain an explicit no-eligible-evidence result
- **AND** it SHALL NOT expose the revoked portrait as current cumulative attainment.

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

### Requirement: Teacher class insights aggregate current learner portraits
Teacher class insight APIs SHALL derive the class portrait from the canonical
cumulative portraits of current class members and SHALL read only immutable
`class-competency.cumulative.v2` materializations after migration. The API and
UI SHALL NOT offer a recent scope.

#### Scenario: Class dimension has partial member coverage
- **WHEN** some current members have valid evidence for a portrait dimension and others do not
- **THEN** the class mean SHALL give equal weight to each member with valid evidence for that dimension
- **AND** the response SHALL report included count, missing count, and mean confidence without substituting zero for missing members.

#### Scenario: Membership changes
- **WHEN** a learner joins, leaves, or transfers into a class
- **THEN** the class aggregate SHALL add or remove that learner's latest cumulative projection
- **AND** the learner's portrait and historical facts SHALL NOT be rebuilt, copied, or deleted.

#### Scenario: Class trend and risk are requested
- **WHEN** an authorized teacher opens class trend or risk summaries
- **THEN** the response SHALL aggregate current members' last personal trend and last evidence-backed risk states
- **AND** it SHALL NOT infer trend from changes in the class mean or clear risk because no newer fact exists.

#### Scenario: Removed recent scope is requested
- **WHEN** a client explicitly requests `scope=recent` or another removed calendar-window portrait scope
- **THEN** the API SHALL return an explicit unsupported-scope error
- **AND** it SHALL NOT ignore the parameter, fall back to cumulative, or construct a compatibility portrait.

### Requirement: Teacher student insight exposes cumulative growth history
Teacher student insight APIs SHALL expose a privacy-safe summary of meaningful
cumulative growth events for current class members.

#### Scenario: Teacher opens growth history
- **WHEN** an authorized teacher opens a current member's growth history
- **THEN** the response SHALL include meaningful level changes, strength changes, evidence-backed risk changes, and important contributed milestones in newest-first order
- **AND** it SHALL NOT expose a duplicate of every activity or role-restricted raw payload.

#### Scenario: Student leaves the teacher's classes
- **WHEN** the learner is no longer a current member of any class managed by the teacher
- **THEN** teacher access to that learner's portrait, evidence, and growth history SHALL end immediately.

### Requirement: Teacher cumulative portraits expose task-attainment composition
Authorized teacher student-detail and class-attainment responses SHALL expose the task-normalized simulation completion count, current related-task count, and privacy-safe grouped task composition when the personal portrait has an eligible simulation dimension.

#### Scenario: Teacher reads a student's cumulative simulation attainment
- **WHEN** an authorized teacher opens a current class member with an eligible simulation task projection
- **THEN** the response includes the student's completed-task count, related-task count, and grouped task summary
- **AND** it does not expose raw run payloads, answers, hidden scoring details, or unrelated students' task details

#### Scenario: Teacher reads a class simulation aggregate
- **WHEN** an authorized teacher requests cumulative class attainment
- **THEN** the class simulation value is aggregated from current members' latest personal task projections
- **AND** the response uses the arithmetic mean of usable personal task-completion ratios and reports usable-member coverage against the current roster
- **AND** the response does not treat the class as the owner of learning facts or infer a class-time history

#### Scenario: Class comparison lacks a usable task aggregate
- **WHEN** a learner or current class aggregate has no usable task-normalized simulation value
- **THEN** the comparison remains unavailable
- **AND** the teacher response SHALL NOT emit zero values, ahead-or-behind conclusions, or a synthetic trend

### Requirement: Teacher owns class-scoped evidence adaptation
Teacher SHALL own the adapter that maps authorized current projections and report delivery records into class/student evidence views. The adapter SHALL derive teacher, class and student scope from server authorization and SHALL not reconstruct official facts from raw events or accept URL hints as authority.

#### Scenario: Teacher requests an authorized class
- **WHEN** an authenticated teacher requests insights or diagnosis evidence for a class they own
- **THEN** the Teacher owner SHALL read the qualified class/student projection and return coverage, freshness, provenance and permitted evidence fields
- **AND** it SHALL preserve independent-learner suppression and missing/stale status

#### Scenario: Teacher requests another class
- **WHEN** the requested class or student is outside the teacher's authorized membership scope
- **THEN** the adapter SHALL reject before reading evidence
- **AND** it SHALL not fall back to global, raw or client-supplied identifiers

### Requirement: Teacher adapter migration preserves report and privacy semantics
Moving Teacher evidence adapters SHALL preserve report revision, class-session provenance, role-minimum fields, small-sample suppression, raw access restrictions and historical report identity. It MUST NOT write official scores, LearningFacts or Personalization state as a side effect of a read.

#### Scenario: Small class has sensitive aggregate
- **WHEN** an authorized class has fewer than the independent-learner threshold
- **THEN** the Teacher owner SHALL suppress sensitive aggregate values while retaining truthful status and coverage
- **AND** it SHALL not replace missing values with zero or include another class

#### Scenario: Legacy report adapter remains in use
- **WHEN** a route, worker or report still imports the old data-governance business adapter
- **THEN** the migration SHALL keep that path until parity and zero-caller evidence exist
- **AND** it SHALL not add a forwarding facade that hides the unresolved dependency


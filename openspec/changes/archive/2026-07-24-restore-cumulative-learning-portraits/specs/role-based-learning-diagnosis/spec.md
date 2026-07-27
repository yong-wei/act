## MODIFIED Requirements

### Requirement: Diagnosis views are role-specific
The system SHALL materialize student, teacher, and service views from one
canonical cumulative diagnosis. Personal and class overview surfaces SHALL
default to an overall diagnosis across the seven portrait v2 dimensions;
goal-specific and graph-aware diagnoses SHALL remain subordinate drilldowns.
It SHALL NOT materialize a 30-day or other calendar-window diagnosis.

#### Scenario: Student diagnosis is requested
- **WHEN** a student opens their profile or growth overview
- **THEN** the diagnosis SHALL include overall level, overall conclusion, strengths, improvement areas, limitations, last trend, last risk, evidence coverage, and student-readable next actions
- **AND** it SHALL use only portrait dimensions with valid evidence.

#### Scenario: Teacher class diagnosis is requested
- **WHEN** an authorized teacher opens a class diagnosis
- **THEN** the diagnosis SHALL include seven-dimension class coverage and means, strength and improvement clusters, member trend and risk distributions, denominator, confidence, evidence coverage, and drilldown references
- **AND** it SHALL not substitute a control-correction or other single-goal diagnosis for the overall diagnosis.

#### Scenario: Teacher student consultation is requested
- **WHEN** an authorized teacher opens an individual consultation view
- **THEN** the diagnosis SHALL include the learner's overall level, evidenced dimensions, strengths, improvement areas, last trend, last risk, cumulative evidence summary, limitations, and registered intervention resources
- **AND** it SHALL preserve current-class membership authorization.

#### Scenario: Teacher student consultation lacks target student
- **WHEN** a teacher-student diagnosis is requested without an explicit target student
- **THEN** the diagnosis SHALL expose a missing target student limitation
- **AND** it SHALL NOT materialize student path details, learner-state dimensions, class-wide learner evidence, or target-scoped next-action links.

#### Scenario: Teacher graph-node diagnosis is requested
- **WHEN** an authorized teacher opens a class diagnosis from Graph Center or a graph-aware prep-pack flow
- **THEN** the diagnosis SHALL include target LearningGoal or graph node scope, overlay distribution, affected population, denominator, confidence, resource coverage gaps, evidence refs, citation refs, version refs, and intervention priority
- **AND** it SHALL remain a subordinate scoped diagnosis and any student drilldown SHALL remain limited to current class members.

### Requirement: Diagnosis claims are evidence-backed
Diagnosis output SHALL not present a personalized or class claim without
governed evidence references, coverage, confidence, and an evidence cutoff.
Elapsed time since the cutoff SHALL be descriptive only and SHALL NOT
invalidate an otherwise current cumulative diagnosis.

#### Scenario: Evidence-backed claim is emitted
- **WHEN** a diagnosis claim is materialized
- **THEN** it SHALL identify governed evidence references, evidence cutoff, source coverage, confidence state, materialization version, and privacy class
- **AND** it SHALL distinguish missing dimensions from dimensions with valid low scores.

#### Scenario: Evidence is insufficient
- **WHEN** evidence is missing, partial, preview-only, or low confidence
- **THEN** the diagnosis SHALL expose the specific limitation and a valid recovery action
- **AND** it SHALL NOT present the claim as complete or replace missing values with zero.

#### Scenario: Existing evidence is old but unchanged
- **WHEN** no new governed fact has appeared after the current diagnosis evidence cutoff
- **THEN** the diagnosis SHALL retain its last supported claims, trend, and risk
- **AND** it SHALL expose evidence age without labeling the diagnosis unavailable solely because of elapsed time.

## ADDED Requirements

### Requirement: Overall diagnosis uses seven-dimensional evidence coverage
The overall diagnosis SHALL calculate personal and class summaries only from
portrait v2 dimensions with valid governed evidence.

#### Scenario: Personal portrait has missing dimensions
- **WHEN** a learner has evidence for fewer than seven portrait dimensions
- **THEN** the overall score SHALL average only evidenced dimensions
- **AND** the diagnosis SHALL report evidenced and missing dimension counts without treating missing dimensions as zero.

#### Scenario: Class portrait has missing member dimensions
- **WHEN** current members have different evidence coverage by dimension
- **THEN** each class dimension SHALL use its own evidenced-member denominator
- **AND** the class diagnosis SHALL report included members, missing members, and mean confidence for that dimension.

### Requirement: Trend and risk preserve the last evidence-triggered state
Personal diagnosis SHALL derive trend and risk from consecutive cumulative
states produced by relevant governed evidence. Class diagnosis SHALL aggregate
the current members' last personal states. Activity age and calendar windows
SHALL be descriptive only and SHALL NOT create an alternative trend or risk.
Evidence-derived risk SHALL remain distinct from teacher attention,
intervention, completion, or other human disposition.

#### Scenario: Personal cumulative score changes
- **WHEN** a new evidence-triggered cumulative overall score differs from the previous score by more than `+5`, less than `-5`, or within those bounds
- **THEN** the personal trend SHALL respectively be rising, falling, or stable
- **AND** the first valid state SHALL be marked as having no comparison.

#### Scenario: No new relevant evidence exists
- **WHEN** no new eligible fact affects a learner's trend or a risk type
- **THEN** the last personal trend and risk SHALL remain unchanged
- **AND** calendar time or an unrelated fact SHALL NOT clear or replace either state.

#### Scenario: Teacher disposition changes
- **WHEN** a teacher acknowledges, intervenes on, or completes handling of a current evidence risk
- **THEN** diagnosis views SHALL update the human disposition independently
- **AND** they SHALL retain the evidence risk until a governed fact transition changes it.

#### Scenario: Unsupported legacy risk is requested
- **WHEN** a legacy `participation` or `ai_misuse` risk remains in audit storage
- **THEN** cumulative personal and class diagnosis SHALL exclude it from current risk output
- **AND** `constraint`, `stagnation`, and `cross_domain` SHALL follow their governed deterministic transition rules.

#### Scenario: Class trend is displayed
- **WHEN** a teacher opens class trend
- **THEN** the view SHALL show counts and proportions of current members whose last personal trend is rising, stable, falling, or not comparable
- **AND** it SHALL NOT calculate a trend from historical class means.

### Requirement: Diagnosis availability exposes actionable reasons
Diagnosis APIs SHALL return a specific availability reason whenever a requested
field cannot be materialized.

#### Scenario: Diagnosis field is unavailable
- **WHEN** a portrait or diagnosis field is missing because there is no eligible fact, migration is running, processing failed, no registered resource matches, or the field is hidden for the current role
- **THEN** the response SHALL distinguish those reasons
- **AND** it SHALL associate an available retry, reconciliation, learning, or authorization action without replacing an existing supported field with a generic empty state.

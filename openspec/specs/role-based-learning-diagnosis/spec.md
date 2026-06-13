## Purpose

Provide a stable, governed diagnosis layer that materializes student, teacher, and service-facing learning diagnosis views from privacy-safe evidence. The layer standardizes judgments, root causes, confidence limits, next actions, and evidence references for future student profile, teacher consultation, prep-pack, grading, and Konling surfaces.
## Requirements
### Requirement: Diagnosis views are role-specific
The system SHALL materialize role-specific learning diagnosis views for students, teachers, and service consumers.

#### Scenario: Student diagnosis is requested
- **WHEN** a student opens a learning overview for a registered goal
- **THEN** the diagnosis SHALL include current judgment, student-readable explanation, supporting evidence references, confidence or limitation state, and next-action links.

#### Scenario: Teacher class diagnosis is requested
- **WHEN** an authorized teacher opens a class diagnosis
- **THEN** the diagnosis SHALL include root-cause clusters, affected population, denominator, confidence, evidence coverage, intervention priority, and class-scoped drilldown references.

#### Scenario: Teacher student consultation is requested
- **WHEN** an authorized teacher opens an individual consultation view
- **THEN** the diagnosis SHALL include dimension, indicator, evidence, recent change, likely cause, and intervention resources
- **AND** it SHALL preserve class-scope authorization.

#### Scenario: Teacher student consultation lacks target student
- **WHEN** a teacher-student diagnosis is requested without an explicit target student
- **THEN** the diagnosis SHALL expose a missing target student limitation
- **AND** it SHALL NOT materialize student path details, learner-state dimensions, class-wide learner evidence, or target-scoped next-action links.

### Requirement: Diagnosis claims are evidence-backed
Diagnosis output SHALL not present a personalized claim without evidence and confidence metadata.

#### Scenario: Evidence-backed claim is emitted
- **WHEN** a diagnosis claim is materialized
- **THEN** it SHALL identify governed evidence references, evidence window, source coverage, confidence state, materialization version, and privacy class.

#### Scenario: Evidence is insufficient
- **WHEN** evidence is missing, stale, partial, preview-only, or low confidence
- **THEN** the diagnosis SHALL expose the limitation
- **AND** it SHALL NOT present the claim as a complete or precise diagnosis.

### Requirement: Diagnosis surfaces are role-projected
Role-based diagnosis surfaces SHALL expose different summaries from the same governed snapshot without leaking private evidence.

#### Scenario: Student opens diagnosis surface
- **WHEN** a student opens a diagnosis surface for the competition baseline
- **THEN** the surface SHALL show dimension status, score or band, confidence, percentile or unavailable reason, growth state, evidence references, limitations, and next actions
- **AND** it SHALL include a path-entry action when a valid control-correction path recommendation exists
- **AND** it SHALL NOT expose teacher-only cohort diagnostics, classmate evidence, private peer evidence, teacher-only rationale, or raw internal scoring payloads.

#### Scenario: Teacher opens class diagnosis surface
- **WHEN** a teacher opens a class diagnosis surface
- **THEN** the surface SHALL show cohort distributions, weak-point clusters, affected population, denominator, source coverage, confidence, evidence drilldown, limitation states, prep-pack entry state, and available prep-pack actions
- **AND** any student drilldown SHALL remain scoped to students in the teacher's class.

### Requirement: Evidence drilldowns preserve privacy
Evidence drilldowns SHALL be inspectable and privacy-safe.

#### Scenario: Evidence drawer is opened
- **WHEN** a user opens evidence for a diagnosis dimension
- **THEN** the drawer SHALL show source family, source title, observation time window, confidence, limitation state, and citation payload where available
- **AND** fields that are not permitted for the viewer's role SHALL be redacted rather than omitted silently.

#### Scenario: Student opens evidence drawer
- **WHEN** a student opens evidence behind a diagnosis claim
- **THEN** the drawer SHALL show only that student's visible evidence summaries, source capsule, confidence, freshness, and allowed citation links
- **AND** raw answer bodies, private Konling memory, hidden Arena internals, and teacher-only notes SHALL remain hidden.

#### Scenario: Teacher opens student drilldown
- **WHEN** a teacher opens a student-specific diagnosis drilldown
- **THEN** the drawer SHALL show class-authorized evidence summaries, path execution state, grading anchors, and intervention resources
- **AND** it SHALL not include raw private dialogue unless a future spec explicitly permits it.

### Requirement: Diagnosis surfaces expose degraded states
Diagnosis UI SHALL make missing, stale, partial, low-confidence, and cold-start states visible.

#### Scenario: No current snapshot exists
- **WHEN** a role-specific diagnosis surface lacks a current report snapshot
- **THEN** it SHALL show a degraded state with retry or adjacent actions
- **AND** it SHALL NOT render placeholder scores as real diagnosis.

#### Scenario: Cohort percentile is unavailable
- **WHEN** percentile or growth percentile cannot be computed due to sample size, missing history, or authorization limits
- **THEN** the surface SHALL display the limitation rather than hiding the metric or substituting a fabricated value.

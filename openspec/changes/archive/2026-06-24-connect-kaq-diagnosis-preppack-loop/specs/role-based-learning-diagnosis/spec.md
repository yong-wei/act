## MODIFIED Requirements

### Requirement: Diagnosis views are role-specific
The system SHALL materialize role-specific learning diagnosis views for students, teachers, and service consumers, including graph-aware class diagnosis when K/A/Q context is available.

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

#### Scenario: Teacher graph-node diagnosis is requested
- **WHEN** an authorized teacher opens a class diagnosis from Graph Center or a graph-aware prep-pack flow
- **THEN** the diagnosis SHALL include target LearningGoal or graph node scope, overlay distribution, affected population, denominator, confidence, resource coverage gaps, evidence refs, citation refs, version refs, and intervention priority
- **AND** any student drilldown SHALL remain scoped to students in the teacher's class.

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

#### Scenario: Teacher opens graph-aware class diagnosis surface
- **WHEN** a teacher opens diagnosis for K/A/Q graph weak points
- **THEN** the surface SHALL show weak graph nodes, resource gap status, prep-pack entry state, source coverage, confidence, evidence drilldown, and limitation states
- **AND** it SHALL not expose raw private dialogue, hidden Arena internals, raw submissions, or reversible low-denominator distributions.

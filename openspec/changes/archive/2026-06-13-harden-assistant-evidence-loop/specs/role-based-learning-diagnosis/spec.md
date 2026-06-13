## MODIFIED Requirements

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

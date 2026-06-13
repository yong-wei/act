## MODIFIED Requirements

### Requirement: Diagnosis surfaces are role-projected
Role-based diagnosis surfaces SHALL expose different summaries from the same governed snapshot without leaking private evidence.

#### Scenario: Student opens diagnosis surface
- **WHEN** a student opens a diagnosis surface for the competition baseline
- **THEN** the surface SHALL show dimension state, confidence, limitations, personal evidence references, and next learning actions
- **AND** it SHALL include a path-entry action when a valid control-correction path recommendation exists
- **AND** it SHALL NOT expose classmate evidence, teacher-only rationale, or raw internal scoring payloads.

#### Scenario: Teacher opens class diagnosis surface
- **WHEN** a teacher opens a class diagnosis surface
- **THEN** the surface SHALL show class distribution, root-cause clusters, evidence coverage, limitation states, and available prep-pack actions
- **AND** any student drilldown SHALL remain scoped to students in the teacher's class.

### Requirement: Evidence drilldowns preserve privacy
Evidence drilldowns SHALL be inspectable and privacy-safe.

#### Scenario: Evidence drawer is opened
- **WHEN** a user opens evidence for a diagnosis dimension
- **THEN** the drawer SHALL show source family, source title, observation time window, confidence, limitation state, and citation payload where available
- **AND** fields that are not permitted for the viewer's role SHALL be redacted rather than omitted silently.

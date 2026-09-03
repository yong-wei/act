## MODIFIED Requirements

### Requirement: Diagnosis surfaces are role-projected

Role-based diagnosis surfaces SHALL expose different summaries from the same governed snapshot without leaking private evidence.

#### Scenario: Student opens diagnosis surface
- **WHEN** a student opens a diagnosis surface for the competition baseline
- **THEN** the surface SHALL show dimension status, score or band, confidence, percentile or unavailable reason, growth state, evidence references, limitations, and next actions
- **AND** it SHALL include a path-entry action when a valid control-correction path recommendation exists
- **AND** every executable student next action SHALL use a currently valid student learning route
- **AND** when no specific resource can be determined, the action SHALL use the formal Interactive Learning course directory as the honest fallback
- **AND** it SHALL NOT expose teacher-only cohort diagnostics, classmate evidence, private peer evidence, teacher-only rationale, or raw internal scoring payloads.

#### Scenario: Teacher opens class diagnosis surface
- **WHEN** a teacher opens a class diagnosis surface
- **THEN** the surface SHALL show cohort distributions, weak-point clusters, affected population, denominator, source coverage, confidence, evidence drilldown, limitation states, prep-pack entry state, and available prep-pack actions
- **AND** any student drilldown SHALL remain scoped to students in the teacher's class.

#### Scenario: Teacher opens graph-aware class diagnosis surface
- **WHEN** a teacher opens diagnosis for K/A/Q graph weak points
- **THEN** the surface SHALL show weak graph nodes, resource gap status, prep-pack entry state, source coverage, confidence, evidence drilldown, and limitation states
- **AND** it SHALL not expose raw private dialogue, hidden Arena internals, raw submissions, or reversible low-denominator distributions.

### Requirement: Diagnosis availability exposes actionable reasons

Diagnosis APIs SHALL return a specific availability reason whenever a requested field cannot be materialized. Student-facing next actions SHALL be either valid formal learning entries or explicit unavailable states; they MUST NOT be empty links or obsolete route aliases.

#### Scenario: Diagnosis field is unavailable
- **WHEN** a portrait or diagnosis field is missing because there is no eligible fact, migration is running, processing failed, no registered resource matches, or the field is hidden for the current role
- **THEN** the response SHALL distinguish those reasons
- **AND** it SHALL associate an available retry, reconciliation, learning, or authorization action without replacing an existing supported field with a generic empty state
- **AND** a missing learning destination SHALL be represented as unavailable rather than `#`, the current page, or an obsolete route.

#### Scenario: Growth recommendation has no specific resource
- **WHEN** a student receives a valid evidence-backed growth recommendation but no specific course or resource can be determined
- **THEN** the recommendation SHALL link to `/interactive-learning/courses`
- **AND** opening the link SHALL reach the formal student course directory without changing evidence, score, unlock, or path state.

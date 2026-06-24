## MODIFIED Requirements

### Requirement: Diagnosis views are role-specific
The system SHALL materialize role-specific learning diagnosis views for students, teachers, and service consumers, including graph-aware class diagnosis when K/A/Q context is available.

#### Scenario: Teacher graph-node diagnosis is requested
- **WHEN** an authorized teacher opens a class diagnosis from Graph Center or a graph-aware prep-pack flow
- **THEN** the diagnosis SHALL include target LearningGoal or graph node scope, overlay distribution, affected population, denominator, confidence, resource coverage gaps, evidence refs, citation refs, version refs, and intervention priority
- **AND** any student drilldown SHALL remain scoped to students in the teacher's class.

### Requirement: Diagnosis surfaces are role-projected
Role-based diagnosis surfaces SHALL expose different summaries from the same governed snapshot without leaking private evidence.

#### Scenario: Teacher opens graph-aware class diagnosis surface
- **WHEN** a teacher opens diagnosis for K/A/Q graph weak points
- **THEN** the surface SHALL show weak graph nodes, resource gap status, prep-pack entry state, source coverage, confidence, evidence drilldown, and limitation states
- **AND** it SHALL not expose raw private dialogue, hidden Arena internals, raw submissions, or reversible low-denominator distributions.

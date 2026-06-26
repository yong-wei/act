## ADDED Requirements

### Requirement: Source Pack retrieval is profile-aware
The system SHALL apply retrieval behavior according to the consuming profile before ranking and serialization.

#### Scenario: Konling answer profile is used
- **WHEN** a Source Pack is built for `konling-answer`
- **THEN** the candidate set SHALL be filtered to permitted student-visible or role-authorized evidence before ranking
- **AND** citations SHALL be concise, citation-ready, and free of hidden learner data or teacher-only material unless the caller role permits it.

#### Scenario: Authoring or assessment profile is used
- **WHEN** a Source Pack is built for `handout-authoring`, `lesson-design`, or `assessment-item`
- **THEN** the profile SHALL apply appropriate authority, review-state, source-type, AI-use, answer-leakage, and excerpt-budget policies
- **AND** the resulting pack SHALL expose limitations for excluded or missing coverage.

#### Scenario: Path-planning profile is used
- **WHEN** a Source Pack is built for `path-planning`
- **THEN** retrieval SHALL use LearningGoal, knowledge node, capability target, resource readiness, and PlanningUnit context where available
- **AND** the pack SHALL distinguish path-eligible resources from supporting citation-only evidence.

### Requirement: Source Pack retrieval uses hybrid ranking signals
The system SHALL combine governed scope filtering with exact, lexical, graph/objective, authority, freshness, learner-context, eligibility, and optional semantic/vector ranking signals.

#### Scenario: Exact technical term is queried
- **WHEN** the query contains a formula, exercise id, section title, named concept, graph node, or citation target
- **THEN** exact or lexical matches SHALL remain eligible even when semantic/vector similarity is weak or unavailable.

#### Scenario: Graph or objective context is supplied
- **WHEN** the query includes knowledge nodes, capability targets, quality targets, LearningGoal ids, or resource constraints
- **THEN** the ranking SHALL use those refs to filter or rerank candidates
- **AND** inaccessible or disallowed candidates SHALL remain excluded.

### Requirement: Source Pack assembly enforces budgets and diversity
The system SHALL assemble packs with bounded excerpts, source diversity, modality diversity, citation readiness, and limitation reporting.

#### Scenario: Many similar chunks match
- **WHEN** many chunks from the same resource, citation target, or modality match a query
- **THEN** the builder SHALL diversify the selected pack according to profile budgets
- **AND** it SHALL report omitted coverage or source concentration as audit metadata when relevant.

#### Scenario: Coverage is incomplete
- **WHEN** no eligible material covers a requested knowledge node, capability target, resource type, or modality
- **THEN** the Source Pack SHALL include a limitation describing the missing coverage
- **AND** downstream consumers SHALL be able to display or store that limitation.

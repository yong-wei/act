## ADDED Requirements

### Requirement: Resource matching ranks audited graph-aware candidates
The system SHALL rank graph-aware resource candidates using governed ResourceNode, graph, overlay, citation, and version metadata.

#### Scenario: Path candidate resources are ranked
- **WHEN** the planner requests resource candidates for a LearningGoal subgraph and learner overlay
- **THEN** the ranker SHALL score only ResourceNodes or generated checkpoint contracts that pass planning audit
- **AND** scoring SHALL consider graph coverage, capability contribution, evidence potential, learner fit, accessibility, freshness, time cost, cognitive load, readiness, and governance limitations.

#### Scenario: Candidate is rejected
- **WHEN** a candidate is blocked by missing path audit, scene unavailability, privacy policy, teacher policy, readiness, missing citation, missing launch target, stale version, or terminal-validation mismatch
- **THEN** the ranker SHALL return a rejection or limitation reason suitable for planner diagnostics and teacher/admin review.

### Requirement: Ranking explanations are inspectable
Ranked resource output SHALL include explanation metadata rather than a black-box score.

#### Scenario: Ranked candidate is returned
- **WHEN** a candidate appears in the ranked list
- **THEN** the output SHALL include score, feature contributions, matched graph refs, evidence potential, resource/citation limitations, version context, and tie-break reason where applicable.

### Requirement: Scene weights are explicit
The resource matching layer SHALL support explicit scene-specific ranking weights.

#### Scenario: Konling requests resource advice
- **WHEN** resource ranking is requested for Konling graph advice
- **THEN** citation readiness, authority, graph relevance, and privacy visibility SHALL be weighted for answer grounding
- **AND** path eligibility SHALL remain separate from retrieval/citation suitability.

#### Scenario: Prep-pack requests resource candidates
- **WHEN** resource ranking is requested for teacher prep-pack generation
- **THEN** class overlay gap, affected population, teacher actionability, insertion fit, and governance limitations SHALL be available as ranking signals where present.

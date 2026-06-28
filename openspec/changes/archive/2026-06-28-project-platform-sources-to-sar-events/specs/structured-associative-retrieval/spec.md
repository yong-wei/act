## ADDED Requirements

### Requirement: Platform sources project to SAR events deterministically
The system SHALL project governed platform sources into SAR events and entities using stable platform identifiers.

#### Scenario: Graph and LearningGoal sources are projected
- **WHEN** K/A/Q objectives, graph nodes, portrait dimensions, LearningGoal definitions, or ExpandedGoalSubgraph fixtures are projected
- **THEN** SAR SHALL emit events and entities for the graph/objective/goal boundary
- **AND** each graph node event SHALL bind at least one graph node entity, objective entity where applicable, and portrait dimension entity where applicable.

#### Scenario: Resource and evidence sources are projected
- **WHEN** ResourceNode, ResourceSegment, CitationTarget, RetrievalChunk, PlanningUnit, or LearningEvidenceCorpusChunk records are projected
- **THEN** SAR SHALL preserve source refs, resource refs, graph refs, citation target refs, path eligibility signals, privacy scope, authority, and freshness metadata
- **AND** retrieval chunks or citation targets SHALL NOT be promoted into path-plannable nodes.

### Requirement: SAR projection reuses graph resource coverage semantics
SAR projection SHALL reuse the same graph/resource matching semantics as Graph Center coverage.

#### Scenario: Resource coverage matching is needed
- **WHEN** SAR binds a resource or evidence chunk to a graph node
- **THEN** it SHALL use the shared ResourceNode and evidence corpus matching logic also used by graph resource coverage
- **AND** it SHALL expose limitations rather than silently diverging from Graph Center coverage counts.

### Requirement: SAR projection protects private learner and evaluation data
The system SHALL project only governed summaries for private or scoped evidence.

#### Scenario: Private learner evidence is projected
- **WHEN** LearningFact, grading, simulation, Arena, path, diagnosis, teacher report, Konling, or prep-pack records contain learner-scoped or audit-only data
- **THEN** SAR SHALL project only redacted summaries or stable refs permitted by the caller scope
- **AND** it SHALL carry privacy limitations for omitted raw content.

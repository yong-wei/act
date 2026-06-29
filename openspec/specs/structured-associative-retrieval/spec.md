# structured-associative-retrieval Specification

## Purpose
TBD - created by archiving change define-structured-associative-retrieval-contract. Update Purpose after archive.
## Requirements
### Requirement: SAR contract defines governed associative events and entities
The system SHALL define a structured associative retrieval contract over existing platform identifiers without copying raw governed content.

#### Scenario: Retrieval event is created
- **WHEN** a SAR event is created from course content, resource governance, learner evidence, grading, simulation, Arena, path, diagnosis, teacher report, Konling, or prep-pack data
- **THEN** the event SHALL include stable id, event type, title, safe summary, source owner, source ref, authority level, privacy scope, freshness, and content hash where available
- **AND** it SHALL NOT include restricted raw content, hidden evaluation internals, private Konling memory, raw learner submissions, or audit-only traces.

#### Scenario: Retrieval entity is created
- **WHEN** a SAR entity is created
- **THEN** it SHALL include entity type, canonical platform ref, label, aliases, and privacy scope
- **AND** platform stable ids SHALL be preferred over LLM-extracted free text.

### Requirement: SAR relations preserve role, confidence, and provenance
The system SHALL represent event/entity associations as auditable relations.

#### Scenario: Event is associated with an entity
- **WHEN** a SAR event references a graph node, objective, resource, citation, path node, learner evidence, class, or student
- **THEN** the relation SHALL include role, confidence in the range 0 to 1, and source provenance such as deterministic id, metadata projection, teacher approval, or LLM extraction.

### Requirement: SAR does not verify final citations
SAR SHALL provide associative candidates and traces but SHALL NOT be the final citation verifier.

#### Scenario: A downstream consumer needs verified citations
- **WHEN** a SAR result includes citation target refs or retrieval chunk refs
- **THEN** final citation verification, address resolution, and CitationChip payload construction SHALL remain owned by the governed citation layer or Source Pack consumer
- **AND** SAR SHALL expose limitations rather than presenting candidates as verified citations.

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

### Requirement: SAR expands associations from governed seed refs
The system SHALL provide a deterministic association expansion provider over projected SAR events and entities.

#### Scenario: Zero-hop expansion is requested
- **WHEN** a caller supplies seed refs and requests zero-hop expansion
- **THEN** SAR SHALL return directly associated events, entities, selected refs, rejected refs, and limitations within the caller scope.

#### Scenario: Multi-hop expansion is requested
- **WHEN** a caller requests one-hop or two-hop expansion
- **THEN** SAR SHALL expand from seed entities to events and connected entities, then to additional events within the requested hop budget
- **AND** it SHALL record the hop path in trace metadata.

### Requirement: SAR expansion enforces caller scope before returning candidates
The system SHALL filter association results by role, student, class, privacy scope, authority, and use case before exposing candidates.

#### Scenario: Student-visible expansion finds scoped evidence
- **WHEN** a student-scoped SAR query reaches teacher-scoped, admin-scoped, audit-only, or another student's private events
- **THEN** those events SHALL be excluded or redacted
- **AND** the trace SHALL include rejected refs or limitations without leaking raw private details.

### Requirement: SAR expansion feeds Source Pack instead of replacing it
SAR SHALL return candidate refs and trace suitable for downstream Source Pack retrieval.

#### Scenario: Downstream evidence pack is needed
- **WHEN** a consumer needs ranked excerpts, citation hydration, or verified citation chips
- **THEN** SAR SHALL provide candidate `eventId`, `entityId`, `retrievalChunkId`, `citationTargetId`, `resourceNodeId`, or `planningUnitId` refs
- **AND** Source Pack or the governed citation layer SHALL own ranking, excerpt budgets, citation verification, and CitationChip payloads.

### Requirement: Konling consumes SAR as grounding association context
Konling SHALL use SAR association expansion as a server-owned grounding enhancement when scoped seed refs are available.

#### Scenario: Konling has graph or path seed refs
- **WHEN** a Konling mode receives LearningGoal, graph node, capability target, resource, path node, citation, learner, or class seed refs
- **THEN** it MAY request SAR association expansion within the mode's role and privacy scope
- **AND** it SHALL receive associated event refs, entity refs, candidate refs, limitations, and trace metadata.

#### Scenario: Konling needs verified evidence
- **WHEN** SAR returns candidate retrieval or citation refs for a factual or personalized answer
- **THEN** Konling SHALL pass those refs to Source Pack or the governed citation layer for verified evidence
- **AND** it SHALL NOT present SAR candidates themselves as verified citations.

### Requirement: Konling SAR trace is privacy-redacted
Konling SHALL expose only safe SAR trace summaries to student-visible responses.

#### Scenario: Student-visible answer uses SAR
- **WHEN** a student-visible Konling answer uses SAR associations
- **THEN** the response metadata or diagnostics SHALL omit raw private evidence, teacher-scoped internals, and audit-only trace details
- **AND** limitations SHALL describe missing or restricted context without revealing private data.


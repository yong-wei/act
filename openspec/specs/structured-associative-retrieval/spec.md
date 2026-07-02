# structured-associative-retrieval Specification

## Purpose
Structured Associative Retrieval is ACT's governed association layer over stable platform references for learning evidence, resources, graph nodes, Arena, path planning, diagnosis, reports, Konling, and prep-pack context. SAR exposes privacy-scoped candidates, traces, limitations, and diagnostics; it does not copy raw governed content, replace final citation verification, or override graph-mandated path-planning authority.
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

### Requirement: Graph Center consumes SAR associated evidence
Graph Center SHALL expose SAR-associated evidence for selected graph nodes when scoped association data is available.

#### Scenario: Node detail is opened
- **WHEN** a user opens a Graph Center node detail with SAR enabled
- **THEN** the selected node detail MAY include associated event count, safe top events, trace summary, candidate resource refs, and limitations
- **AND** visibility SHALL match the viewer role and scope.

### Requirement: SAR resource gap suggestions remain draft-only
SAR SHALL provide resource gap candidates without mutating graph bindings or ResourceNode governance state.

#### Scenario: Resource coverage is missing
- **WHEN** a graph node lacks RAG-indexed, citation-ready, assessment, simulation, Arena, path-eligible, or terminal validation coverage
- **THEN** Graph Center MAY request SAR candidate resources or evidence
- **AND** all candidates SHALL be marked suggested or draft until reviewed by the resource governance workflow.

### Requirement: Path planning treats SAR as supplemental candidate evidence
Adaptive path planning SHALL consume SAR candidates only as supplemental candidate evidence and explanation basis.

#### Scenario: SAR returns relevant resource candidates
- **WHEN** SAR association expansion returns candidate resource, retrieval chunk, citation target, or planning unit refs for a LearningGoal
- **THEN** the planner MAY use those refs to locate audited ResourceNode/PlanningUnit candidates
- **AND** it SHALL keep SAR candidates behind graph-mandated, teacher-assigned, and ordinary ResourceNode-eligible candidates.

#### Scenario: SAR candidate is not path eligible
- **WHEN** a SAR candidate lacks an audited ResourceNode, PlanningUnit, privacy permission, teacher policy permission, readiness, or terminal validation capability required by the LearningGoal
- **THEN** the planner SHALL reject it as a PathNode candidate and record a reason
- **AND** it MAY keep it only as supporting evidence when allowed.

### Requirement: SAR exposes diagnostics and evaluation traces
The system SHALL expose privacy-safe diagnostics for SAR projection, refresh health, and query behavior through service payloads and administrator-visible governance surfaces.

#### Scenario: Administrator reviews SAR health
- **WHEN** an administrator opens SAR diagnostics or requests the SAR report payload
- **THEN** the system SHALL expose event count, entity count, relation count, source type counts, privacy scope counts, refresh freshness, stale source counts, query trace summaries, hop counts, privacy rejection counts, limitation counts, and downstream verified citation rate where available.

### Requirement: SAR evaluation includes a multi-hop teaching demo
The system SHALL provide a deterministic SAR demo fixture for multi-hop teaching retrieval.

#### Scenario: Control-correction demo query is executed
- **WHEN** the demo asks why a learner should address frequency response margins before controller correction simulation and Arena validation
- **THEN** the SAR trace SHALL show LearningGoal, graph nodes, resources, learner evidence limitations, simulation/Arena evidence, Source Pack handoff, and verified citation outcomes where available.

### Requirement: SAR persists governed retrieval index records
The system SHALL persist SAR retrieval events, entities, event-entity relations, and query traces after the first-stage SAR contract is stable.

#### Scenario: Projection records are persisted
- **WHEN** a governed SAR projection writes events, entities, or event-entity relations
- **THEN** the system SHALL persist stable ids, type, safe summary or label, source reference, authority level, privacy scope, freshness, content hash where available, relation role, relation confidence, relation source, and version refs
- **AND** repeated projection of the same stable SAR ids SHALL update or preserve records idempotently without duplicating relations.

#### Scenario: Query trace is persisted
- **WHEN** a SAR association query is executed for a governed use case
- **THEN** the system SHALL persist query role, use case, student or class scope where permitted, query hash, seed entities, selected events, rejected refs, limitations, version refs, and downstream Source Pack or citation handoff state.

### Requirement: SAR persistence excludes restricted raw content
The system SHALL keep persisted SAR records privacy-safe and citation-boundary aware.

#### Scenario: Restricted evidence reaches persistence
- **WHEN** a SAR event, entity, relation, or trace references learner answers, hidden Arena evaluation internals, private Konling memory, raw audit traces, or audit-only evidence
- **THEN** the persisted record SHALL contain only permitted stable refs, redacted summaries, limitation codes, or rejection metadata
- **AND** raw restricted content SHALL NOT be stored in SAR persistence or exported diagnostics.

### Requirement: SAR query trace retention is minimized
The system SHALL define retention and minimization rules for persisted SAR query traces before storing student-scoped or class-scoped trace history.

#### Scenario: Student-scoped trace is persisted
- **WHEN** a SAR query trace includes student scope, class scope, seed entities, selected refs, or rejected refs
- **THEN** the system SHALL store hash-only query identity instead of raw query text
- **AND** it SHALL attach a retention window, minimization policy, and export eligibility state.

#### Scenario: Trace retention window expires
- **WHEN** a persisted SAR trace reaches its retention or minimization boundary
- **THEN** the system SHALL delete, aggregate, or redact student-scoped trace details according to the retention policy
- **AND** expired or restricted trace details SHALL NOT appear in administrator exports, teacher surfaces, or evaluation reports.

### Requirement: SAR projection refresh is governed and observable
The system SHALL refresh persisted SAR projections from governed platform sources through an auditable workflow.

#### Scenario: SAR projection refresh runs
- **WHEN** SAR refresh is triggered automatically or manually
- **THEN** the system SHALL project governed K/A/Q graph, LearningGoal, ResourceNode, evidence corpus, LearningFact summary, simulation, Arena, and path summary sources through the SAR projection contract
- **AND** persisted SAR records SHALL be updated idempotently without copying restricted raw content.

#### Scenario: SAR source is stale or failed
- **WHEN** a source family cannot be refreshed or its source version is stale
- **THEN** SAR health SHALL record source family, stale or failed state, last attempted refresh, last successful refresh where available, limitation code, and retry status.

#### Scenario: Arena source is refreshed
- **WHEN** SAR refresh projects Arena evidence, summaries, or evaluation context
- **THEN** official score, validity, ranking, attempt policy, and evaluation metrics SHALL be sourced only from persisted ArenaSubmission or official evaluation run records
- **AND** LearningFact, SAR trace, KAQ writeback, or learner evidence summaries SHALL remain auxiliary learning evidence context, not official Arena result truth.

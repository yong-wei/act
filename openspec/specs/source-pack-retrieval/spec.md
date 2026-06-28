## Purpose

Define governed Source Pack retrieval evidence packages for authoring tools, Konling, and path planning.
## Requirements
### Requirement: Source Pack contract defines governed retrieval evidence packages
The system SHALL expose a Source Pack contract that represents a governed, auditable evidence package for authoring tools, Konling, and path planning.

#### Scenario: Source Pack is generated
- **WHEN** a caller asks for a Source Pack
- **THEN** the pack SHALL include a stable pack id, caller profile, query context, index or projection version refs, coverage summary, selected items, limitations, and audit metadata
- **AND** every item SHALL retain stable source identifiers such as `retrievalChunkId`, `citationTargetId`, `resourceNodeId`, or `planningUnitId` when those identifiers are available.

#### Scenario: Source Pack item is serialized
- **WHEN** a Source Pack item is rendered to JSON or Markdown
- **THEN** it SHALL preserve title, source kind, modality, excerpt, inclusion rationale, score fields, access metadata, and citation metadata
- **AND** it SHALL NOT rely on model-authored URLs or raw authoring-file line numbers as the verified citation target.

### Requirement: Source Pack CLI is a thin wrapper over shared core
The system SHALL provide a CLI shell for local authoring and agent workflows without making the CLI the retrieval source of record.

#### Scenario: CLI builds a pack
- **WHEN** an authoring workflow runs the Source Pack CLI with a query and profile
- **THEN** the CLI SHALL call the shared Source Pack builder
- **AND** it SHALL be able to write JSON, Markdown, and audit outputs with the same contract used by server consumers.

#### Scenario: CLI cannot satisfy retrieval
- **WHEN** a requested adapter, index, or retrieval mode is unavailable
- **THEN** the CLI SHALL return a valid Source Pack with explicit limitations or a structured failure
- **AND** it SHALL NOT silently fall back to unmanaged raw Markdown scanning.

### Requirement: Source Pack adapts governed corpus records
The system SHALL build Source Pack candidates from governed corpus records and runtime projections rather than unmanaged authoring files.

#### Scenario: Learning evidence chunk enters Source Pack candidate set
- **WHEN** a governed `LearningEvidenceCorpusChunk` is eligible for the caller scope
- **THEN** the Source Pack adapter SHALL preserve source type, family, span ref, citation address, authority, privacy scope, freshness, content hash, and limitation metadata
- **AND** invalid, inaccessible, or privacy-violating chunks SHALL be excluded or represented only as explicit limitations.

#### Scenario: Textbook or reference runtime document enters Source Pack candidate set
- **WHEN** a reviewed textbook or reference runtime search document is adapted
- **THEN** the candidate SHALL preserve book id, section id, title, page or anchor metadata, figure/equation refs where available, source version, graph refs, content hash, review state, and citation target metadata
- **AND** the adapter SHALL NOT read raw authoring Markdown as the source of record.

### Requirement: Source Pack hydrates citations from server-owned metadata
The system SHALL resolve Source Pack citation payloads from server-owned CitationAddress or CitationTarget metadata.

#### Scenario: Citation is hydrated
- **WHEN** a Source Pack item references a citation target or citation address
- **THEN** the hydrator SHALL produce display title, label, source kind, href or unavailable state, address kind, anchor metadata, freshness, and limitation state from server-owned metadata
- **AND** model-authored links SHALL NOT be accepted as verified citation targets.

#### Scenario: Citation metadata is unsafe or incomplete
- **WHEN** a citation address is missing, stale, unsafe, restricted, provisional, or incompatible with the caller scope
- **THEN** the Source Pack item SHALL expose an explicit limitation or be excluded according to profile policy
- **AND** the pack SHALL remain auditable.

### Requirement: Source Pack keeps retrieval readiness separate from path eligibility
The system SHALL distinguish retrievable or citable material from resources that can become adaptive path nodes.

#### Scenario: Retrieval chunk is citable but not path eligible
- **WHEN** a `RetrievalChunk` or `CitationTarget` is adapted into Source Pack evidence
- **THEN** it MAY support citation and authoring context
- **AND** it SHALL NOT become a path-plannable node unless an audited `PlanningUnit` and `ResourceNode` eligibility record exists.

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


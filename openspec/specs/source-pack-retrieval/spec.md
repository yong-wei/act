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


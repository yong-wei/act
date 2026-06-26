## ADDED Requirements

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

## ADDED Requirements

### Requirement: Textbook and reviewed media projections enter the governed RAG corpus
The governed RAG corpus SHALL support resource retrieval projections for registered teaching resources without creating a separate unmanaged corpus.

#### Scenario: Grounded textbook chunk is indexed
- **WHEN** a reviewed textbook section or figure description is indexed
- **THEN** the chunk SHALL include section id, page anchor, source version, authority, graph refs, citation target, privacy scope, and content hash
- **AND** citation verification SHALL use server-owned CitationAddress metadata rather than model-authored links.

#### Scenario: Reviewed media projection chunk is indexed
- **WHEN** a transcript segment, image description, slide segment, or infograph description from a validated media ingestion projection is indexed
- **THEN** the chunk SHALL include segment anchor, source version, AI-use permission, review state, graph refs, citation target, privacy scope, freshness metadata, tool/version where applicable, input scope, output hash, retention rule, and limitation state
- **AND** provisional chunks SHALL be retrievable only with a limitation state until reviewed.

### Requirement: Grounded textbook and media citations resolve through server-owned addresses
Verified citations SHALL resolve through a server-owned CitationAddress contract rather than model-authored URLs.

#### Scenario: Citation comes from external-tool output
- **WHEN** transcript tooling, OCR, local vision models, or prompt extraction supply a candidate citation or description
- **THEN** the system SHALL resolve display href and limitation state from server-owned metadata
- **AND** it SHALL NOT trust generated text to construct final citation URLs or verified source claims.

#### Scenario: Student evidence is protected from external processing
- **WHEN** RAG grounding or citation tooling records external/local tool metadata
- **THEN** the record SHALL include tool name, version, input scope, output hash, permission, and retention rule
- **AND** student raw answers, classroom evidence, and learner state SHALL NOT be sent to external tools by default.

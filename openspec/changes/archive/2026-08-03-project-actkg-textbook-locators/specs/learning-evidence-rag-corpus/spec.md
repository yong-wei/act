## MODIFIED Requirements

### Requirement: Textbook and reviewed media projections enter the governed RAG corpus
The governed RAG corpus SHALL support structured textbook units, retrieval windows, and reviewed media projections without creating a separate unmanaged corpus. Textbook projection rows MAY enter the governed corpus only when their public locator, Authority identity, access mode, Canonical binding, and citation-safe provenance are complete. A locator-only `REFERENCE_ONLY` row MUST NOT be treated as an authorized raw content body.

#### Scenario: Grounded textbook chunk is indexed
- **WHEN** a reviewed textbook structural unit, fragment, or retrieval window is indexed
- **THEN** it SHALL include owning unit id, stable structure path, fragment or page anchor where applicable, source version, authority, graph refs, citation target, privacy scope, and content hash
- **AND** retrieval windows SHALL NOT become verified citation identities.

#### Scenario: Reviewed media projection chunk is indexed
- **WHEN** a transcript segment, image description, slide segment, or infograph description from a validated media ingestion projection is indexed
- **THEN** the chunk SHALL include segment anchor, source version, AI-use permission, review state, graph refs, citation target, privacy scope, freshness metadata, tool/version where applicable, input scope, output hash, retention rule, and limitation state
- **AND** provisional chunks SHALL be retrievable only with a limitation state until reviewed.

#### Scenario: Authorized runtime section is projected
- **WHEN** a textbook section has a valid locator and an authorized content source
- **THEN** RAG SHALL index the section through its governed runtime/citation contract
- **AND** the result SHALL retain SourceDocument, SourceAnchor, Canonical, Authority, and projection identities

#### Scenario: Only public locator exists
- **WHEN** the section has no authorized body
- **THEN** RAG MAY expose a reference/citation target
- **AND** it SHALL not synthesize or copy textbook body text

### Requirement: Reviewed resource projections have complete citation anchors
Reviewed resource projections used by path planning or Konling grounding SHALL have mapped retrieval chunks and server-owned citation anchors, or explicit limitation states. Every textbook citation candidate MUST retain exact SourceDocument/SourceAnchor and section/page locator metadata. Missing sidecar or ambiguous anchor SHALL fail the textbook projection rather than falling back to a broad or guessed citation.

#### Scenario: Reviewed projection is indexed
- **WHEN** a reviewed textbook section, reference section, media transcript, slide segment, image description, figure, handout, or runtime support resource is indexed
- **THEN** the retrieval chunk SHALL reference its ResourceSegment, CitationTarget, CitationAddress metadata, authority, privacy scope, source hash, freshness, and review state
- **AND** citation verification SHALL resolve display links from server-owned metadata.

#### Scenario: Anchor is incomplete
- **WHEN** a transcript, page, figure, equation, timestamp, slide, image, or external href anchor is missing or stale
- **THEN** the citation SHALL be downgraded or limited
- **AND** the helper SHALL report the missing anchor separately from path-planning disposition.

#### Scenario: Sidecar is incomplete
- **WHEN** a selected textbook row cannot resolve its anchor or locator
- **THEN** that row SHALL be excluded with a machine-readable reason
- **AND** the rest of the RAG/Teaching Projection SHALL remain unchanged

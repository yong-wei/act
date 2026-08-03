## MODIFIED Requirements

### Requirement: Textbook and reviewed media projections enter the governed RAG corpus
Textbook projection rows MAY enter the governed corpus only when their public locator, Authority identity, access mode, Canonical binding, and citation-safe provenance are complete. A locator-only `REFERENCE_ONLY` row MUST NOT be treated as an authorized raw content body.

#### Scenario: Authorized runtime section is projected
- **WHEN** a textbook section has a valid locator and an authorized content source
- **THEN** RAG SHALL index the section through its governed runtime/citation contract
- **AND** the result SHALL retain SourceDocument, SourceAnchor, Canonical, Authority, and projection identities

#### Scenario: Only public locator exists
- **WHEN** the section has no authorized body
- **THEN** RAG MAY expose a reference/citation target
- **AND** it SHALL not synthesize or copy textbook正文

### Requirement: Reviewed resource projections have complete citation anchors
Every textbook citation candidate MUST retain exact SourceDocument/SourceAnchor and section/page locator metadata. Missing sidecar or ambiguous anchor SHALL fail the textbook projection rather than falling back to a broad or guessed citation.

#### Scenario: Sidecar is incomplete
- **WHEN** a selected textbook row cannot resolve its anchor or locator
- **THEN** that row SHALL be excluded with a machine-readable reason
- **AND** the rest of the RAG/Teaching Projection SHALL remain unchanged

## ADDED Requirements
### Requirement: Reviewed resource projections have complete citation anchors
Reviewed resource projections used by path planning or Konling grounding SHALL have mapped retrieval chunks and server-owned citation anchors, or explicit limitation states.

#### Scenario: Reviewed projection is indexed
- **WHEN** a reviewed textbook section, reference section, media transcript, slide segment, image description, figure, handout, or runtime support resource is indexed
- **THEN** the retrieval chunk SHALL reference its ResourceSegment, CitationTarget, CitationAddress metadata, authority, privacy scope, source hash, freshness, and review state
- **AND** citation verification SHALL resolve display links from server-owned metadata.

#### Scenario: Anchor is incomplete
- **WHEN** a transcript, page, figure, equation, timestamp, slide, image, or external href anchor is missing or stale
- **THEN** the citation SHALL be downgraded or limited
- **AND** the helper SHALL report the missing anchor separately from path-planning disposition.

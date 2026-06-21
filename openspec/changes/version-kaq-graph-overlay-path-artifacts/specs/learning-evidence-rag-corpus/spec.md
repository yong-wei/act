## MODIFIED Requirements

### Requirement: Corpus chunks declare authority and scope
Every RAG corpus chunk SHALL declare authority, retrieval scope, and source version or freshness metadata in addition to provenance, privacy, confidence, and freshness.

#### Scenario: Versioned source chunk is indexed
- **WHEN** a corpus chunk is created from a graph-bound resource projection
- **THEN** it SHALL include source version or freshness limitation metadata where available
- **AND** citation verification SHALL preserve that metadata in CitationChip payloads when relevant.

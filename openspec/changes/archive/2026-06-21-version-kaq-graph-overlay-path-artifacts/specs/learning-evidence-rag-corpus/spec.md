## MODIFIED Requirements

### Requirement: Corpus chunks declare authority and scope
Every RAG corpus chunk SHALL declare authority, retrieval scope, and source version or freshness metadata in addition to provenance, privacy, confidence, and freshness.

#### Scenario: Chunk is indexed
- **WHEN** a corpus chunk is created for teaching knowledge or learner evidence
- **THEN** it SHALL include authority level, knowledge tags where applicable, page or span anchor where available, freshness bucket, and scope rule
- **AND** validation SHALL reject chunks whose authority or scope metadata is missing or incompatible with their source type.

#### Scenario: Restricted learner evidence is indexed
- **WHEN** a chunk references private learner evidence, teacher-only summaries, grading anchors, or service-only traces
- **THEN** its scope rule SHALL prevent ordinary retrieval outside the authorized student, teacher, admin, or service scope
- **AND** redacted summaries SHALL be used when raw text is not visible.

#### Scenario: Versioned source chunk is indexed
- **WHEN** a corpus chunk is created from a graph-bound resource projection
- **THEN** it SHALL include source version or freshness limitation metadata where available
- **AND** citation verification SHALL preserve that metadata in CitationChip payloads when relevant.

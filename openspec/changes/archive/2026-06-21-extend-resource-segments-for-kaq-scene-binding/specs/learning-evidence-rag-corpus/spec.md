## MODIFIED Requirements

### Requirement: Retrieval supports resource projections
The governed RAG corpus SHALL support resource retrieval projections for registered teaching resources without creating a separate unmanaged corpus.

#### Scenario: Scene-aware resource projection chunk is indexed
- **WHEN** a Markdown handout, knowledge card, runtime handout, video transcript, audio transcript, image description, exercise, simulation summary, Arena summary, or teacher-reviewed explanation is indexed
- **THEN** the chunk SHALL include resource id or source ref, segment ref, citation target ref where available, K/A/Q graph node refs where available, scene availability, authority level, privacy scope, freshness metadata, and content hash where available
- **AND** retrieval SHALL keep scope filtering, citation verification, and path eligibility as separate decisions.

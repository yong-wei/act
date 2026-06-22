## MODIFIED Requirements

### Requirement: Media source manifests are bounded
The system SHALL define and validate a bounded manifest contract for media repository ingestion.

#### Scenario: Media manifest is validated
- **WHEN** a video, audio, image, or slides source manifest is read
- **THEN** it SHALL declare source id, source path, source version or freshness ref, segment or timecode/page/image refs, graph bindings, scene availability, citation policy, privacy scope, and AI-use permission
- **AND** missing transcript, image description, anchor, graph binding, or citation policy SHALL prevent verified citation readiness for affected segments.

### Requirement: Segment retrieval does not imply path eligibility
ResourceSegment, RetrievalChunk, and CitationTarget SHALL NOT automatically become PathNodes.

#### Scenario: Ingested media chunk is retrievable
- **WHEN** a media RetrievalChunk references a resolvable CitationTarget
- **THEN** it MAY be retrieved or cited according to scope and verification policy
- **AND** it SHALL NOT be path eligible unless a separate ResourceNode or checkpoint contract produces an audited PlanningUnit.

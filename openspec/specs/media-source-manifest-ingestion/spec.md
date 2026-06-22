# media-source-manifest-ingestion Specification

## Purpose
TBD - created by archiving change ingest-media-source-manifests-for-graph-resources. Update Purpose after archive.
## Requirements
### Requirement: Media source manifests are validated before projection
The system SHALL validate media source manifests before generating resource-center projections.

#### Scenario: Video or audio manifest is ingested
- **WHEN** a video or audio manifest is read from an authoring or source repository
- **THEN** validation SHALL require stable source id, source path, media type, segment or timecode refs, transcript or description refs where required by citation policy, graph bindings, scene availability, privacy scope, citation policy, and AI-use permission
- **AND** missing required fields SHALL produce segment-level limitations rather than fabricated verified citations.

#### Scenario: Slides or image manifest is ingested
- **WHEN** a slides or image manifest is read
- **THEN** validation SHALL require stable page or image anchors, text or image descriptions where needed for retrieval, graph bindings, scene availability, citation policy, and AI-use permission
- **AND** missing anchors or descriptions SHALL prevent verified citation readiness for affected segments.

### Requirement: Media manifests project into governed resource semantics
Validated media manifests SHALL project into ResourceSegment, CitationTarget, RetrievalChunk, and ResourceSemanticProjection metadata without bypassing source ownership.

#### Scenario: Projection is generated
- **WHEN** a media manifest segment passes validation
- **THEN** the projection SHALL preserve source refs, segment refs, anchor/time/page refs, graph node refs, scene availability, citation readiness, evidence capability, privacy scope, content hash or freshness ref where available, and limitations
- **AND** raw media, hidden transcripts, or source repository internals SHALL NOT be copied into unrelated runtime records.

### Requirement: Media path eligibility still requires ResourceNode audit
Media source ingestion SHALL NOT make segments path eligible by itself.

#### Scenario: Media segment is citation-ready
- **WHEN** a media segment has a valid transcript, anchor, graph binding, and CitationTarget
- **THEN** it MAY become retrievable or citeable according to scope
- **AND** it SHALL NOT become a PathNode unless ResourceNode or checkpoint audit authorizes a PlanningUnit.


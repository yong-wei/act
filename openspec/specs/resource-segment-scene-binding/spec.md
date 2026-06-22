# resource-segment-scene-binding Specification

## Purpose
TBD - created by archiving change extend-resource-segments-for-kaq-scene-binding. Update Purpose after archive.
## Requirements
### Requirement: Resource segments bind to graph nodes and usage scenes
The system SHALL support graph-aware and scene-aware resource segment metadata for registered teaching resources.

#### Scenario: Segment graph profile is generated
- **WHEN** a textbook section, handout fragment, video clip, audio clip, image description, slide page, exercise, simulation task, or Arena protocol is projected
- **THEN** the segment SHALL be able to expose stable segment id, source ref, anchor, content hash where available, K/A/Q graph node refs, scene availability, citation readiness, evidence capability, and governance limitations.

#### Scenario: Scene availability is evaluated
- **WHEN** a resource segment is considered for path planning, Konling, diagnosis, grading, prep-pack, or reporting
- **THEN** the semantic projection SHALL expose whether the segment is allowed for that scene
- **AND** a disallowed scene SHALL be represented as a limitation rather than silently included.

### Requirement: Segment retrieval does not imply path eligibility
ResourceSegment, RetrievalChunk, and CitationTarget SHALL NOT automatically become PathNodes.

#### Scenario: Chunk has a valid citation target
- **WHEN** a RetrievalChunk references a resolvable CitationTarget
- **THEN** it MAY be retrieved or cited according to scope and verification policy
- **AND** it SHALL NOT be path eligible unless a ResourceNode or generated checkpoint contract produces an audited PlanningUnit.

### Requirement: Media source manifests are bounded
The system SHALL define a bounded manifest contract for future media repository ingestion.

#### Scenario: Media manifest is validated
- **WHEN** a video or audio source manifest is read
- **THEN** it SHALL declare source id, source path, segment or timecode refs, graph bindings, scene availability, citation policy, and AI-use permission
- **AND** missing transcript, anchor, or citation policy SHALL prevent verified citation readiness.

### Requirement: Runtime resource segments bind to graph nodes and usage scenes
The system SHALL support graph-aware and scene-aware resource segment metadata for registered teaching resources.

#### Scenario: Runtime card or infograph segment is generated
- **WHEN** a knowledge card, infograph, lesson figure, or media asset is projected for grounding
- **THEN** the segment SHALL expose source ref, anchor, content hash where available, graph node refs, scene availability, citation readiness, AI-use permission, and review state
- **AND** prompt-derived or local-model-derived semantics SHALL remain provisional until reviewed.
- **AND** human-confirmed segment semantics SHALL record reviewer, reviewed source hash, reviewed version ref, generation tool/model or prompt hash where applicable, confidence, and stale invalidation rules.

#### Scenario: Runtime lesson media is segmented
- **WHEN** video, audio, image, or slide media is projected from runtime content
- **THEN** its segments SHALL declare transcript, timecode, page, image, or slide anchors as applicable
- **AND** missing transcript, anchor, graph binding, citation policy, or AI-use permission SHALL prevent verified citation readiness.


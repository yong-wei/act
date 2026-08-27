# resource-segment-scene-binding Specification

## Purpose
TBD - created by archiving change extend-resource-segments-for-kaq-scene-binding. Update Purpose after archive.
## Requirements
### Requirement: Resource segments bind to graph nodes and usage scenes
The system SHALL support graph-aware and scene-aware resource atom metadata for registered teaching resources. Formal binding atoms SHALL use one stable semantic paragraph for video, audio, podcast, textbook, Knowledge Card, handout, lecture, slide text, or another text-bearing resource, and one stable question/task item for an exercise. Every atom SHALL preserve parent resource, exact runtime subtype, source and content identity, stable atom ID, precise launch anchor, Canonical refs, teaching roles, scene availability, citation readiness, evidence capability, formal disposition, and governance limitations.

#### Scenario: Segment graph profile is generated
- **WHEN** a textbook paragraph, card paragraph, handout paragraph, media semantic paragraph, slide text paragraph, exercise item, simulation task, or Arena protocol is projected
- **THEN** the atom SHALL expose stable atom and parent-resource IDs, exact subtype, source/content hashes, precise anchor, Canonical refs, scene availability, citation readiness, evidence capability, formal disposition, and limitations
- **AND** container-level or retrieval-window identity SHALL not replace the formal atomic anchor

#### Scenario: Scene availability is evaluated
- **WHEN** a resource atom is considered for path planning, Konling, diagnosis, grading, prep-pack, reporting, or formal graph launch
- **THEN** the semantic projection SHALL expose whether the atom is allowed for that scene
- **AND** a disallowed scene SHALL be represented as a limitation rather than silently included

#### Scenario: Exercise item changes
- **WHEN** a stable question ID retains its name but the stem, options, answer, or explanation hash changes
- **THEN** its formal Canonical bindings SHALL become stale
- **AND** the stable ID alone SHALL not preserve formal eligibility

### Requirement: Segment retrieval does not imply path eligibility
ResourceSegment, RetrievalChunk, and CitationTarget SHALL NOT automatically become PathNodes.

#### Scenario: Ingested media chunk is retrievable
- **WHEN** a media RetrievalChunk references a resolvable CitationTarget
- **THEN** it MAY be retrieved or cited according to scope and verification policy
- **AND** it SHALL NOT be path eligible unless a separate ResourceNode or checkpoint contract produces an audited PlanningUnit.

### Requirement: Media source manifests are bounded
The system SHALL define and validate a bounded manifest contract for media repository ingestion.

#### Scenario: Media manifest is validated
- **WHEN** a video, audio, image, or slides source manifest is read
- **THEN** it SHALL declare source id, source path, source version or freshness ref, segment or timecode/page/image refs, graph bindings, scene availability, citation policy, privacy scope, and AI-use permission
- **AND** missing transcript, image description, anchor, graph binding, or citation policy SHALL prevent verified citation readiness for affected segments.

### Requirement: Runtime resource segments bind to graph nodes and usage scenes
The system SHALL support graph-aware and scene-aware atom metadata for registered runtime teaching resources while distinguishing development, candidate, excluded, and formal-included states. A qualified automatic pipeline result MAY become formally eligible without per-item human review only when the exact pipeline qualification and every atom-level gate pass. Model- or prompt-derived output without matching qualification, or any exceptional item, SHALL remain provisional or enter the repository review/disposition artifacts.

#### Scenario: Runtime card or infograph segment is generated
- **WHEN** a Knowledge Card, infograph, lesson figure, text paragraph, or media asset is projected for grounding
- **THEN** the atom SHALL expose source/content identity, stable anchor, Canonical refs, exact subtype, scene availability, citation readiness, AI-use permission, formal state, pipeline lineage, and bounded limitations
- **AND** an unqualified model or prompt output SHALL remain provisional
- **AND** a qualified item SHALL record pipeline version/configuration, qualification receipt, input/output hashes, confidence, and stale-invalidation rules before formal use

#### Scenario: Runtime lesson media is segmented
- **WHEN** video, audio, podcast, image, or slide media is projected from runtime content
- **THEN** its instructional atoms SHALL declare semantic-paragraph, time, page, image, or slide anchors as applicable and bind final media/content identity
- **AND** missing transcript, start time, stable anchor, graph binding, citation policy, source identity, qualification, or AI-use permission SHALL exclude the affected resource from formal admission

#### Scenario: Runtime text is resegmented
- **WHEN** a textbook, card, handout, lecture, or slide-text resource changes
- **THEN** only atoms with unchanged stable IDs and content hashes MAY receive deterministic revalidation
- **AND** changed, added, or removed atoms SHALL be re-dispositioned before formal inclusion

### Requirement: Textbook sections and reviewed media projections bind to graph nodes and usage scenes
The system SHALL support graph-aware and scene-aware resource segment metadata for registered teaching resources. An ACT textbook section binding MUST reference public ActKG `SourceDocument` and `SourceAnchor` identities, exact locator metadata, the current Canonical ID, Authority release, and projection capture. The binding MUST preserve `EXPLAINS` as an ACT teaching role and MUST NOT rewrite upstream graph relations.

#### Scenario: Textbook section is grounded
- **WHEN** a textbook section candidate is completed for grounding
- **THEN** it SHALL include stable section id, book id, page range, source hash, graph node refs, K/A/Q objective refs, citation policy, authority, privacy scope, and review state
- **AND** review confirmation SHALL be required before the section can become path-eligible.

#### Scenario: Reviewed media projection is consumed
- **WHEN** a media ResourceSemanticProjection generated by the media ingestion pipeline is consumed for citation or path consideration
- **THEN** the segment SHALL include anchor metadata, transcript or description refs where applicable, graph refs, scene availability, citation readiness, AI-use permission, authority, privacy scope, review state, source version, tool/version metadata where applicable, input scope, output hash, retention rule, and limitation state
- **AND** external-tool or local-model generated semantics SHALL remain provisional until reviewed
- **AND** this capability SHALL NOT ingest raw audio, video, image, or slide files directly.

#### Scenario: One section explains multiple nodes
- **WHEN** one valid section locator lists multiple Canonical IDs
- **THEN** the builder SHALL emit one deterministic binding per Canonical ID
- **AND** all rows SHALL retain the same section identity and evidence

#### Scenario: Locator crosses captures
- **WHEN** the source document, anchor, or sidecar row belongs to another release/capture
- **THEN** the binding SHALL fail closed and remain out of the active projection

### Requirement: Textbook and media segment retrieval does not imply path eligibility
ResourceSegment, RetrievalChunk, and CitationTarget SHALL NOT automatically become PathNodes.

#### Scenario: Grounded media segment is retrievable
- **WHEN** a grounded media or textbook segment has a valid CitationTarget
- **THEN** it MAY support retrieval and citation according to scope
- **AND** it SHALL remain ineligible for path planning unless an audited ResourceNode or PlanningUnit is explicitly created.

#### Scenario: Upstream media projection is missing
- **WHEN** a course or resource references media that has no validated media ingestion projection
- **THEN** the grounding workflow SHALL emit a limitation
- **AND** it SHALL NOT create a substitute private media segment parser or mark the media path-eligible.

### Requirement: Formal binding does not imply path eligibility or learning evidence
A formal atomic Canonical binding, graph marker, drawer launch, playback, read, or exercise open SHALL NOT by itself make an atom a PathNode, authorize a planning scene, establish mastery, or emit a learning fact. Existing ResourceNode, PlanningUnit, event, assessment, authorization, privacy, and evidence contracts SHALL remain independently required.

#### Scenario: Bound media paragraph is launched
- **WHEN** a learner opens a formal video paragraph at its governed start time
- **THEN** the launch SHALL preserve the resource and atom context for existing feature-owned event contracts
- **AND** the binding or playback SHALL not automatically create mastery evidence or path eligibility

#### Scenario: Bound exercise item exists
- **WHEN** an exercise item has a formal `ASSESSES` binding
- **THEN** the item SHALL still require its existing assessment, authorization, scoring, and evidence contracts before producing a learning fact
- **AND** the graph binding SHALL not reveal answers or scoring payloads


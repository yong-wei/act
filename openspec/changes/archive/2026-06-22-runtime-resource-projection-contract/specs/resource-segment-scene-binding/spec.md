## ADDED Requirements

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

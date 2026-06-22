## Authoring Boundary

Raw media and maintainable manifests belong in authoring/source repositories. Runtime should contain generated consumption artifacts: segment metadata, citation maps, retrieval chunks, projection metadata, and copied or referenced assets only where allowed.

## Manifest Fields

A media manifest should declare:

- source id, source repo, source path, media type, version, license, owner;
- transcript, slide text, image description, or chapter refs where available;
- segments with stable ids, time/page/anchor refs, graph node refs, scene availability, citation policy, evidence capability, and AI-use permission;
- source hash or freshness ref where available;
- privacy and usage scope.

## Projection

Validated manifests can produce:

- ResourceSegments with graph refs and scene availability;
- CitationTargets with server-owned anchors;
- RetrievalChunks for transcripts/descriptions;
- ResourceSemanticProjection metadata;
- PlanningUnit candidate inputs only when ResourceNode audit can verify launch target, privacy, evidence instrumentation, readiness, and path semantics.

## Failure Mode

Missing transcript, missing time/page anchor, missing citation policy, unsafe source path, missing graph binding, or blocked AI-use permission should not fail the entire resource center. It should mark affected segments with limitations and withhold verified citation or path eligibility.

## Boundaries

This change defines ingestion and validation. It does not require automatic Whisper/PaddleOCR execution, bulk media upload UI, or graph editor UI.

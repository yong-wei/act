## Why

Graph-driven planning and Konling grounding now depend on audited ResourceNode and ResourceSemanticProjection metadata. Current registered resources are mostly complete, but runtime lessons, lesson media, knowledge cards, infographs, textbook authoring assets, and quiz banks are not consistently represented with the fields required for path planning.

Without a machine-readable completion audit, later resource backfills can look complete while still missing knowledge bindings, ability impact, evidence instrumentation, readiness, citation policy, or human-review status.

## What Changes

- Add a resource field completion audit contract for all resource families that may feed adaptive paths or Konling.
- Produce a bounded machine-readable inventory of missing ResourceNode, ResourceSegment, CitationTarget, RetrievalChunk, PlanningUnit, and quiz metadata fields.
- Classify each missing field by completion method: manual, local-model-assisted, external-tool-assisted, generated-provisional, or already governed.
- Require human-confirmed fields before resources become high-confidence path PlanningUnits.
- Expose resource coverage limitations for graph nodes when fields are missing, provisional, stale, or awaiting review.

## Capabilities

### Modified Capabilities

- `resource-node-registry`: add field completion audit requirements for resources before path eligibility.
- `graph-resource-coverage-overlay`: expose missing field dimensions and completion status in coverage diagnostics.

## Impact

- Affects ResourceNode audit scripts, authoring/resource governance reports, graph coverage diagnostics, and future resource backfill changes.
- Does not perform the large-scale field completion itself.
- Does not allow generated metadata to bypass manual confirmation when the resource affects path eligibility, readiness, or mastery evidence.

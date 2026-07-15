## Why

The knowledge graph currently expands chapter neighborhoods into distant rings and outward sectors, keeps a large relation taxonomy in learner-facing controls, and closes the node inspector when expandable nodes are activated. This makes the canvas consume space without presenting the prerequisite learning paths that the graph is intended to support.

## What Changes

- Replace the root ring with a compact top-level domain view and make domain activation enter a single-domain knowledge view that hides unrelated domains.
- Replace repeated radial expansion inside a domain with a bounded teaching-order spiral layout using an explicit active lesson's canonicalized runtime card order and authored post-requisite relations; every visible line must still correspond to an authored canonical graph relation.
- Project the runtime relation taxonomy into three learner-facing families: child, post-requisite, and association. Keep raw relation types and evidence available in node details.
- Hide child (`contains`) relations by default, keep association display limited to the selected node's bounded one-hop neighborhood, and allow all three families to be toggled from a compact bottom-left graphical legend; remove the existing raw-type/density/strength/dense-mode relation tools.
- Deduplicate equivalent prerequisite records only after canonical type and authored direction are established, clip edges to node boundaries, use target-boundary arrowheads, and curve genuine parallel or reciprocal relations to prevent overlap; relation names never imply endpoint reversal.
- Highlight the bounded prerequisite-path corridor related to a selected node and animate small directional arrows along the exact rendered path only while that path is focused, with a complete reduced-motion fallback.
- Keep the selected-node inspector open and synchronized independently from domain navigation and graph expansion state.
- Render larger wrapped labels over nodes while preserving bounded node size, collision safety, and light/dark readability.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `resource-node-knowledge-workspace-ui`: Change root/domain navigation, learner-facing relation families, domain layout, edge geometry, focused learning-path motion, labels, compact legend behavior, and selected-node inspector semantics.

## Impact

- Affects `/knowledge` progressive graph navigation and presentation without changing canonical graph files or the K/A/Q schema. It does change the PostgreSQL `KnowledgeLink` projection schema so one canonical relation ID is retained per row, including multiple semantics for the same endpoint pair.
- Makes the canonical runtime relation source a fail-closed prerequisite for root, progressive, and detail responses, and gives runtime-owned database rows an explicit `metadata.runtimeSource` boundary.
- Makes canonical file presence, source fingerprints, canonical DB node ownership, and public node-list sanitization part of that same fail-closed boundary, so cached or external data cannot bypass strict validation.
- Primary implementation areas are `src/features/knowledge/knowledge-graph-system.tsx`, the 2D/3D graph renderers, layout, motion, filtering and visual configuration, the resource inspector, and knowledge graph source projection helpers.
- Existing progressive root, expansion, shard cache, ResourceNode launch, and raw relation metadata contracts remain available but are presented through the new two-level navigation and three-family visual projection.
- Persisted personalized `LearningPath`/ResourceNode path projection is intentionally deferred to a separate governance change; this proposal derives visible learning routes only from canonical post-requisite relations.
- Proposal-time focused graph-spec baseline is 11/12 because one source-string URL assertion is stale; implementation Task 0 replaces it with a behavior contract and establishes 12/12 before feature edits.
- Requires focused unit, interaction, accessibility, reduced-motion, visual, and performance validation for desktop and mobile layouts.

## Why

ResourceNode, runtime lessons, TeachingResource, knowledge cards, media, simulations, Arena tasks, grading artifacts, and RAG chunks currently describe overlapping resource concepts from different angles. As resources grow, adaptive paths, Konling citations, evidence writeback, and teacher governance need a shared semantic contract that preserves source-of-record ownership instead of copying content into another catalog.

## What Changes

- Define a unified resource semantic model that separates `Resource`, `ResourceSegment`, `CitationTarget`, `RetrievalChunk`, `PlanningUnit`, and `PathNode`.
- Require ResourceNode to remain the audited planning contract for adaptive paths.
- Require the semantic layer to centralize identity, mappings, projections, citation references, governance, and audit state without taking ownership of renderable content or teacher-editable catalog metadata.
- Add compatibility mapping rules for existing platform resources.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `resource-node-registry`: clarify how unified resource semantics map into audited ResourceNodes without replacing source-of-record ownership.

## Impact

- Affects resource-node registry contracts, future resource importers, planning projection builders, retrieval projection builders, and teacher/admin diagnostics.
- Does not change runtime rendering, TeachingResource ownership, lesson manifests, or path execution behavior.

## ADDED Requirements

### Requirement: Resource media and RAG typecheck debt preserves citation boundaries
ResourceNode, media manifest, Source Pack, and RAG typecheck repair SHALL align fixtures and helper inputs to current citation and planning boundaries.

#### Scenario: Resource media and RAG cluster is repaired
- **WHEN** the ResourceNode/media/RAG cleanup runs
- **THEN** TypeScript errors in ResourceNode registry tests, Source Pack tests, RAG corpus tests, and `src/lib/resource-node-registry.ts` SHALL be eliminated
- **AND** media segments, citation records, source kinds, and graph-node refs SHALL match current contracts.

#### Scenario: Search or citation support is not promoted
- **WHEN** fixtures are updated for TypeScript
- **THEN** the change SHALL NOT promote raw chunks, media anchors, or citation-only records to path-plannable ResourceNodes unless the existing contract already requires it.

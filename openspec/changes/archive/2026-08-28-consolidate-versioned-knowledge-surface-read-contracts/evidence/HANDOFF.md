# Handoff

Change: `consolidate-versioned-knowledge-surface-read-contracts`
Issue: #1591
Public API: `src/lib/knowledge-surface/read.ts` (`readKnowledgeSurface`)
Contract: `act-knowledge-surface/v1`

## For `retire-superseded-resource-governance-entrypoints` (#1592)

Do not delete in this change:

- Authoritative repository / projection cache
- Domain shard loaders and the #1375 public token envelope
- Legacy `loadKnowledgeGraphData` and progressive remaining shards
- Candidate projection service and admin authorization
- #1543 governed math
- #1589 RegistryIndex generator
- `GET /api/knowledge/playlists`
- Array DTO of `GET /api/knowledge/nodes` until
  `playlist-builder.tsx`, `orchestrator-builder.tsx`, and
  `knowledge-cards-data.ts` stop expecting a JSON array

Deletion candidates after zero-caller evidence:

- Any remaining route that returns knowledge JSON without `knowledgeSurface`
- Client-side reconstruction of release/snapshot/projection identity from URL

Rollback of this change is adapter removal, not reader deletion.

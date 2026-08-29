# Caller denominator

Captured from `41c956295` plus this change's route adapters.
Reverse callers are the listed tests. No compatibility facade with old
selector-accepting behavior was added.

## Public knowledge-surface entry

Owner: `knowledge`.
Path: `src/lib/knowledge-surface/`.
Public function: `readKnowledgeSurface(request)`.

Direct production adapters:

| Adapter | Replacement identity | Callers |
| --- | --- | --- |
| `activeShardResponseForRole` | `knowledgeSurfaceFromLearnerShard` | all `src/app/api/knowledge/shards/active/**` JSON routes |
| `activeProjectionResponse` | `knowledgeSurfaceFromActiveProvenance` | `graph/active`, `nodes/active/[id]` |
| `candidateProjectionResponse` | `knowledgeSurfaceFromCandidateProjection` | `graph/v2`, `nodes/v2/[id]` |
| `legacyGraphResponse` | `knowledgeSurfaceFromLegacyGraph` | `graph/route.ts` object payloads |
| legacy node GET | `knowledgeSurfaceFromLegacyGraph` | `nodes/[id]/route.ts` |
| selector gate | `knowledgeSurfaceSelectorRejection` / expanded candidate gate | active, legacy, candidate JSON/PNG routes |

## Repository / shard / resource owners (not replaced)

| Owner | Path | Notes |
| --- | --- | --- |
| Authoritative repository | `src/lib/authoritative-knowledge/{repository,projections,cache,engineering-authority-consumers}.ts` | still the only candidate/active projection source |
| Domain shards | `src/lib/authority-domain-shards/**` | still the only active shard bytes |
| Learning content | `src/lib/authority-domain-shards/learning-content.ts` | still fail-closed; surface adds `version-drift` classification |
| Resource bindings | `src/lib/authority-domain-shards/resource-bindings.ts` | still source-owned launch maps |
| RegistryIndex | `src/features/knowledge/resource-index/public-api.ts` | identity bound when resource block is present |
| Governed math | `src/lib/governed-math/attach.ts` | #1543 owner; surface copies release/locale identity only |
| Legacy graph | `src/lib/knowledge-graph-source.ts` | still the only Legacy loader |
| Candidate policy | `src/features/knowledge/candidate-graph-policy.ts` | admin authorization unchanged |

## Route / API / test denominator

Production routes under `src/app/api/knowledge/` (16 files). Playlists remain
unmigrated by explicit non-goal.

Tests covering the new envelope:

- `src/lib/knowledge-surface/__tests__/knowledge-surface-read-contract.test.ts`
- `src/lib/__tests__/active-authority-graph-route.test.ts`
- `src/lib/__tests__/candidate-authoritative-graph-route.test.ts`
- `src/lib/__tests__/active-authority-projection.test.ts`
- `src/features/knowledge/__tests__/knowledge-node-detail-route*.test.ts`
- `src/features/knowledge/__tests__/knowledge-graph-lesson-context-route.test.ts`
- `src/features/knowledge/__tests__/knowledge-nodes-route.test.ts`
- `src/features/knowledge/__tests__/relation-coverage-route.test.ts`

Browser clients of shard JSON (`src/features/knowledge/active-authority-graph.tsx`)
continue to match `isPublicAuthorityLearnerShard`; `knowledgeSurface` is additive.

Array client of `GET /api/knowledge/nodes`
(`playlist-builder.tsx`, `orchestrator-builder.tsx`, `knowledge-cards-data.ts`)
keeps the array DTO. Envelope lives on the object graph/detail routes.

## Scripts / generated / Prisma

No knowledge-release writer, generated shard builder, or Prisma read-model was
changed. Physical retirement of superseded assemblers is R4
(`retire-superseded-resource-governance-entrypoints`, #1592).

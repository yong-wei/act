# Migration ledger

## Assemblers

| Assembler | Owner | Replacement | Denominator | Deletion / rollback |
| --- | --- | --- | --- | --- |
| `activeShardResponseForRole` JSON body | active workspace | same function plus `knowledgeSurfaceFromLearnerShard` | shard JSON routes + `active-authority-projection.test.ts` | rollback removes additive `knowledgeSurface`; do not delete shard loader. R4 owns later token-envelope retirement |
| `activeProjectionResponse` | active workspace | same helper plus provenance envelope | `graph/active`, `nodes/active/[id]` | rollback drops second argument / nested envelope |
| `rejectCandidateSelectorParameters` 3-key list | candidate | shared `KNOWLEDGE_SURFACE_IDENTITY_SELECTOR_KEYS` | `candidate-authoritative-graph-route.test.ts` | rollback restores 3 keys only; not a delete |
| `candidateProjectionResponse` raw projection | candidate | plus `knowledgeSurfaceFromCandidateProjection` | `graph/v2`, `nodes/v2/[id]` | rollback drops nested envelope |
| `GET /api/knowledge/graph` object payloads | legacy | `legacyGraphResponse` | graph route tests | rollback returns builder payload without `knowledgeSurface` |
| `GET /api/knowledge/nodes/[id]` | legacy | additive envelope | node detail tests | rollback returns detail object only |
| `GET /api/knowledge/nodes` array | legacy search | selector rejection only | array clients listed in caller-denominator | wrapping the array is R4 after those clients migrate |
| Infograph PNG | active | selector rejection; bytes unchanged | `active-authority-graph-route.test.ts` | binary responses never carry JSON envelope |

No permanent wrapper with old selector-accepting behavior remains. Identity
selectors are rejected rather than ignored.

## Retained historical / immutable readers

| Reader | Why retained |
| --- | --- |
| `AuthoritativeKnowledgeRepository` / projection cache | candidate and activation contracts #1125/#1131 |
| Domain shard store / public token envelope | #1375 browser matching |
| `loadKnowledgeGraphData` and progressive shards | Legacy production graph |
| `attachGovernedMathToLearnerShard` | #1543 presentation owner |
| `getLiveResourceRegistryIndex` | #1589 index owner |
| Playlists route | out of scope |

## Optional-status matrix

| Condition | Surface block | Base engineering |
| --- | --- | --- |
| Teaching match true, v2 manifest aligned, RegistryIndex present | teaching/resources/learningContent `available` | readable |
| Teaching match false / projection hash drift | teaching `identity-mismatch`; resources/learningContent `omitted` | readable |
| Optional card/media missing | learningContent `missing` / `unavailable` | readable |
| v1 or non-v2 learning-content manifest | learningContent `version-drift` | readable; no synthesized teaching |
| RegistryIndex load fails while bindings were available | resources `unavailable`; bindings stripped | readable |
| Engineering-only / teaching `null` | teaching/resources `not-applicable` | readable |

Formal consumers keep their own hard gates. This surface does not downgrade them.

## Rollback

Remove route adapter calls to `readKnowledgeSurface` /
`withKnowledgeSurface` and restore prior `NextResponse.json` bodies. Keep
`src/lib/knowledge-surface/` as diagnostic evidence until R4. Do not mutate
Authority, Teaching Projection, RegistryIndex, activation pointers, or
selectors.

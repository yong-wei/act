# Characterization

Change: `retire-superseded-resource-governance-entrypoints`
Issue: #1592
Capture revision: `fce5b9fc4a4c7dd408297c3d90d2cf407c953b71`
(integration HEAD after R3 `#1591` / PR `#1681`)

## 1.1 Replacement identities

| Slice | Contract | Public API | Status |
| --- | --- | --- | --- |
| R1 `#1589` | `resource-registry-index/v1` | `src/features/knowledge/resource-index/public-api.ts` `resolveStudentVisibleIndexedResource` | archived, live |
| R2 `#1590` | `resource-eligibility/v1` | `src/features/knowledge/resource-eligibility/public-api.ts` `evaluateResourceEligibility` | archived, live |
| R3 `#1591` | `act-knowledge-surface/v1` | `src/lib/knowledge-surface/read.ts` `readKnowledgeSurface` | archived, live |

No second Authority/Knowledge read model, Prisma schema, selector, or activation writer was added.

## 1.2 Candidate set (closed)

| id | role | source | retireable | disposition |
| --- | --- | --- | --- | --- |
| `registry-read:student-resources-id-metadata-fallback` | registry-read | `GET /api/resources/[id]` old metadata fallback | no | already-absent (migrated in R1; route now calls RegistryIndex) |
| `eligibility:full-resource-path-readiness-gate` | eligibility-read | `src/lib/full-resource-path-readiness-gate.ts` | yes | retained (audit script + tests) |
| `eligibility:resource-node-aggregate-ready` | eligibility-read | `src/lib/resource-node-registry.ts` planning `readiness` | yes | retained (protected planning owner) |
| `knowledge-projection:nodes-list-array-dto` | knowledge-resource-projection | `GET /api/knowledge/nodes` array DTO | yes | retained (UI clients, tests, scripts, browser audits) |
| `knowledge-projection:client-url-identity-reconstruction` | knowledge-resource-projection | leftover URL identity helper | no | already-absent (R3 selector rejection remains) |

Source-owned render registry, `registeredResourceMetadata`, ResourceNode planning registry, Prisma `TeachingResource`, Legacy `loadKnowledgeGraphData`, Authority/shard loaders, Teaching Projection / Runtime Release readers, `#1498`/`#1503`/`#1509`/`#1515`/`#1543`, and `GET /api/knowledge/playlists` are protected, not deletion candidates.

## 1.3 This change's public target

- `verifyResourceGovernanceRetirement(manifest, currentGraph)` in `src/lib/resource-governance-retirement/`
- Exact-path deletion command `deleteRetiredResourceGovernanceEntrypoints`
- Live worktree recapture `captureRetirementWorktree` immediately before unlink
- `postDeleteImportBuild` bound to import/build and test command results

Live deletion in this slice: none. Completing the gate with explicit retain conditions is the authorized outcome when callers or protected surfaces remain.

# Characterization

Inventory captured against implementation parent `41c956295`
(`consolidate-versioned-knowledge-surface-read-contracts`).

## 1.1 Dependency-contract input

| Input | Status | Evidence |
| --- | --- | --- |
| `define-resource-identity-and-generated-registry-index` | archived | `openspec/changes/archive/2026-08-28-define-resource-identity-and-generated-registry-index/` |
| `enforce-modular-domain-dependency-contracts` | archived | `openspec/changes/archive/2026-08-26-enforce-modular-domain-dependency-contracts/` |
| Resource index HANDOFF | bind `RegistryIndex.identity` when a resource block is present | `evidence/HANDOFF.md` of #1589 |
| #1543 governed math | existing owner | `src/lib/governed-math/attach.ts`, `GOVERNED_MATH_PRESENTATION_BUNDLE` |
| Active workspace | existing owner | `src/app/api/knowledge/_active-authority.ts` |
| Authoritative repository | existing owner | `src/lib/authoritative-knowledge/` |
| Domain shards | existing owner | `src/lib/authority-domain-shards/` |

No second Authority/Knowledge read model, Prisma schema, activation pointer, or
cutover selector was added.

## 1.2 Frozen readers (mode classification)

| Mode | Reader / assembler | Routes |
| --- | --- | --- |
| active | `readActiveRootShard` / domain / family / neighborhood / detail | `GET /api/knowledge/shards/active/**` |
| active | `readActiveCanvas` / `readActiveNode` | `GET /api/knowledge/graph/active`, `GET /api/knowledge/nodes/active/[id]` |
| active | `readActiveDetailInfograph` (bytes) | `GET /api/knowledge/shards/active/nodes/[id]/infograph` |
| candidate | `readCandidateCanvas` / `readCandidateNode` | `GET /api/knowledge/graph/v2`, `GET /api/knowledge/nodes/v2/[id]` |
| legacy | `loadKnowledgeGraphData` / root / expansion / remaining | `GET /api/knowledge/graph` |
| legacy | `buildKnowledgeNodeDetailFromGraph` | `GET /api/knowledge/nodes/[id]` |
| legacy search list | `filterKnowledgeNodes` (array DTO retained) | `GET /api/knowledge/nodes` |

Out of scope: `GET /api/knowledge/playlists`.

## 1.3 Frozen response and cache fields

Public object responses now carry additive `knowledgeSurface`:

- `contractVersion` = `act-knowledge-surface/v1`
- `surface.kind` / `surface.id`
- `mode` ∈ `active` \| `legacy` \| `candidate`
- `role`, `locale`
- exact Authority `snapshotId` / `snapshotHash` / `releaseId` / `releaseSetId`
- teaching / RegistryIndex identities only when those blocks are present
- `blocks.{engineering,teaching,resources,learningContent,math}`
- math identity delegated to `GOVERNED_MATH_PRESENTATION_BUNDLE` (#1543)

Existing shard `envelope` version tokens (`authorityCatalogVersion`,
`teachingVersion`) remain for #1375 browser matching. They are not a second
read model.

Cache keys (`buildKnowledgeSurfaceCacheKey`) isolate mode, role, locale,
surface, Authority, teaching, RegistryIndex, and math identities.

Client identity selectors listed in
`KNOWLEDGE_SURFACE_IDENTITY_SELECTOR_KEYS` are rejected with HTTP 400.
Navigation intents (`locale`, graph `mode`, `domainId`, `lessonId`, `search`,
`type`, `bloom`) remain allowed.

Learning-content v1 / non-v2 contracts classify as `version-drift` and never
synthesize teaching text.

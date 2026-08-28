# Foreign-identity matrix

No pair below is an alias. The generated index may carry them only as typed
foreign references when the source actually supplies the value.

| Identity | Owner | Typical form | Index use |
| --- | --- | --- | --- |
| `ResourceIdentity.key` | generated index | sha256 of `(sourceKind, sourceRef, sourceVersion, contentHash, scope)` | sole index identity |
| Render `registryId` | `resource-registry.tsx` / metadata `id` | `lesson14-three-band-studio` | `foreignRefs.registryId`; render-metadata `sourceRef` |
| Prisma `TeachingResource.id` | DB `TeachingResource` | cuid | `foreignRefs.teachingResourceId` only if source provides it |
| Runtime lesson/media ref | runtime bundle / release | `lessons/<unit>/media/<file>` | `foreignRefs.runtimeResourceRef` only from published-artifact adapter |
| Canonical ID | Authority | ActKG object id | `foreignRefs.canonicalIds`; never guessed from title or registryId |
| ResourceNode ID | planning registry | `registry:<registryId>` or `arena-task:<taskId>` | `foreignRefs.resourceNodeId`; planning adapter `sourceRef` |
| Formal binding ID | Teaching Projection / binding contract | binding record id | `foreignRefs.formalBindingIds`; never inferred |

## Proven non-aliases

- Metadata `id` and Prisma `TeachingResource.id` coexist in `GET /api/resources/[id]`:
  DB lookup is by TeachingResource primary key; index fallback is by
  render-metadata `sourceRef`. A DB hit never consults the index.
- `getRegisteredResourceMetadataByNodeId('registry:' + id)` is a planning lookup
  key, not a TeachingResource id.
- Arena workbench metadata uses `arena-task:<arenaTaskId>` as the planning node
  id; that string is not a Canonical ID.
- `knowledgeNodeIds` on metadata are graph coverage hints, not Authority
  Canonical IDs, and are not copied into `foreignRefs.canonicalIds`.
- Render registry (133 components) is a subset of metadata (336 records). Missing
  components are a render-time concern of `resource-registry.tsx`, not an identity
  merge.

## Collision rule

Two records that share a label or where one id resembles another keep distinct
`(sourceKind, sourceRef)` pairs. The builder rejects duplicate
`sourceKind+sourceRef` and duplicate identity keys rather than merging.

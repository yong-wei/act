# Migration ledger

## Duplicate table classification

| Table | Owner | Status | Deletion condition |
| --- | --- | --- | --- |
| `registeredResourceMetadata` in `resource-registry-metadata.ts` | source-owned metadata | retained | never in this change; it is the render-metadata adapter input |
| `registry` in `resource-registry.tsx` | render owner | retained | never; render implementation stays here |
| ResourceNode registry | planning owner | retained | never; planning lifecycle stays here |
| Prisma `TeachingResource` | DB owner | retained | never |
| `runtime-resource-projections.jsonl` | derived projection | not an index source | must not be scanned as a source; retirement belongs to R4 |
| New handwritten central resource table | none | not created | N/A |

No duplicate handwritten index was deleted. Descriptor parity for the migrated
student fallback is proven by
`resource-registry-index.test.ts` and `resources-api-route.test.ts`.

## Migrated consumer

| Consumer | Old path | Replacement | Remaining checks |
| --- | --- | --- | --- |
| `GET /api/resources/[id]` registry fallback | `getRegisteredResourceMetadata(id)` + local visibility filter | `resolveStudentVisibleIndexedResource(id)` via `RegistryIndex` | Prisma lookup first; PATCH authorization unchanged; student role rechecked at resolve |

## Optional-status matrix

| Condition | Index status | Student GET |
| --- | --- | --- |
| Render metadata present, student-visible, launcher verified | `available` | 200 synthetic TeachingResource-shaped JSON from descriptor |
| Teacher-only / teacher-scoped / teacher-assigned / archived / blocked | entry retained; student resolve `unavailable` | 404 |
| Filesystem or `src/` launch target | `unavailable`, `launcher-contract-absent` | 404 |
| Optional published artifact declared missing | `unavailable`, `optional-artifact-missing` | not used by this consumer |
| Required published artifact missing | adapter fail-closed | N/A |
| Unrelated knowledge base node | unaffected | unaffected |

## Rollback

Restore `GET /api/resources/[id]` to `getRegisteredResourceMetadata`. Keep the
generated index files as diagnostic evidence. No Prisma, runtime release, or
selector mutation occurred.

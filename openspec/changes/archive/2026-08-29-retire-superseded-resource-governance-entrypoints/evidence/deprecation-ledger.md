# Deprecation ledger — retire-superseded-resource-governance-entrypoints

Domain-local ledger. The frozen architecture-charter census in `docs/architecture/deprecation-ledger.md` is not modified.

Capture revision: `fce5b9fc4a4c7dd408297c3d90d2cf407c953b71`
Allowlist exceptions: none (empty; monotonic rule forbids adding exceptions)

| id | owner | consumers | replacement | state | deletion condition | rollback |
| --- | --- | --- | --- | --- | --- | --- |
| `registry-read:student-resources-id-metadata-fallback` | knowledge | none (call site already gone) | `resource-registry-index/v1` | already-absent | do not unlink `src/app/api/resources/[id]/route.ts`; it now hosts the replacement | restore R1 pre-migration route |
| `eligibility:full-resource-path-readiness-gate` | resource-governance | 13 (audit test, generate script, docs/openspec) | `resource-eligibility/v1` purpose=`path` | retained | migrate remaining callers, then exact-file delete | restore `src/lib/full-resource-path-readiness-gate.ts` |
| `eligibility:resource-node-aggregate-ready` | resource-node-registry | 73 classified importers of the planning registry | seven-dimension eligibility snapshots | retained | split a historical adapter out of the protected planning registry | restore registry bytes; do not delete planning owner |
| `knowledge-projection:nodes-list-array-dto` | knowledge | 33 (UI clients, tests/scripts/audits, docs/openspec) | `act-knowledge-surface/v1` | retained | migrate array clients and remaining tests/scripts/audits, then change or retire the array DTO | restore `src/app/api/knowledge/nodes/route.ts` |
| `knowledge-projection:client-url-identity-reconstruction` | knowledge | none | `act-knowledge-surface/v1` selector rejection | already-absent | keep `src/lib/knowledge-surface/selectors.ts`; no leftover helper to unlink | n/a |

No wrapper was marked retired. No compatibility pattern was broadened.

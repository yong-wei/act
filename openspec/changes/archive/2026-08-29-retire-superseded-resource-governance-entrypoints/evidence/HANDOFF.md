# Handoff

Change: `retire-superseded-resource-governance-entrypoints`
Issue: #1592
Public API: `src/lib/resource-governance-retirement/`
Gate: `verifyResourceGovernanceRetirement(manifest, currentGraph)`
Deletion: `deleteRetiredResourceGovernanceEntrypoints` (exact paths only)

## Result

Evidence-gated retirement is implemented. Live deletion of resource-governance entrypoints in this slice is **none**. Remaining candidates are retained with explicit deletion conditions in `evidence/deprecation-ledger.md`.

## Still not deleted (follow-up slices)

- `getRegisteredResourceMetadata` / `getAllRegisteredResourceMetadata` source table (live RegistryIndex adapter input plus assessment/governance callers)
- `full-resource-path-readiness-gate.ts` until audit scripts/tests migrate to `evaluateResourceEligibility` purpose=`path`
- ResourceNode planning `readiness` aggregate until it is split from the protected registry
- `GET /api/knowledge/nodes` array DTO until playlist/orchestrator/knowledge-card clients consume `knowledgeSurface`
- `GET /api/knowledge/playlists`
- Legacy graph loader, Authority/shard readers, Teaching Projection / Runtime Release readers, `#1543` math

Do not treat a re-export or renamed wrapper as retirement. Do not edit the frozen architecture-charter census to hide remaining debt.

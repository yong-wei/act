# Current-head consolidation delta

- schemaVersion: `act-architecture-current-head-delta/v1`
- sourceCommit: `e86d16f4f8b759b62840d9268e12ee58eab02883`
- sourceTree: `483e8db9e4ecddf350084245080f7c2bc735592e`
- captureTime: `2026-09-01T21:14:31+08:00`
- predecessor.sourceCommit: `58c77cbf6e0f6cd284e1eea6a39ca4df8854ebac`
- predecessor.sourceTree: `189dfeb5ad35f1d88e8ea5509a48b388424bf88f`
- predecessor.schemaVersion: `act-architecture-census/v1`
- predecessor.censusCoreSha256: `40549dcad9b03da31abc6ef05c5ede5bff4e04b47268f86450831aa39788c52a`
- commandScope: `current-head-delta:assessment-adaptive-personalization`
- nodeVersion: `v26.0.0`
- npmVersion: `11.12.1`
- typescriptVersion: `5.8.3`

This package is a delta, not a second baseline. It does not rewrite the historical census, charter, or deprecation ledger.

## Slice denominators

| slice | discovered | represented | excluded | duplicate | unresolved |
| --- | --- | --- | --- | --- | --- |
| owner-conflict | 3 | 0 | 0 | 0 | 3 |
| retirement | 22 | 0 | 0 | 0 | 22 |
| hotspot | 5 | 5 | 0 | 0 | 0 |

## Exclusions

- openspec/changes/archive
- docs/architecture/modular-monolith/baseline
- generated:.next
- generated:node_modules
- secrets-learner-payloads-media-screenshots-absolute-paths-command-logs

## Active OpenSpec overlaps

| changes | kind | paths | order |
| --- | --- | --- | --- |
| capture-current-head-consolidation-delta, simplify-personalization-learner-state | predecessor-delta | src/features/personalization/learner-state/internal.ts | later-owner-migration-must-consume-qualified-current-head-delta |
| capture-current-head-consolidation-delta, simplify-personalization-path-assembly | predecessor-delta | src/features/personalization/path-planning/internal/assemble-plan.ts | later-owner-migration-must-consume-qualified-current-head-delta |
| complete-assessment-runtime-owner-migration, move-assessment-and-personalization-evidence-adapters-to-domain-owners | path | src/features/assessment/public-api.ts | overlapping-active-changes-must-not-claim-the-same-deletion-set |
| explain-active-path-node-decisions, retire-adaptive-business-ownership-and-lib-entrypoints | path | src/features/adaptive/adaptive-path-journey-contracts.ts; src/lib/adaptive-path-correction-decisions.ts | overlapping-active-changes-must-not-claim-the-same-deletion-set |
| retire-adaptive-business-ownership-and-lib-entrypoints, simplify-personalization-path-assembly | path | src/lib/adaptive-planning/ | overlapping-active-changes-must-not-claim-the-same-deletion-set |

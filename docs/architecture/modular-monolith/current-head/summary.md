# Current-head consolidation delta

- schemaVersion: `act-architecture-current-head-delta/v1`
- sourceCommit: `c6f2e31dd909e14e4c9e6b9fc5b17d5d1f2d8268`
- sourceTree: `cba1be46722d4e7019f0170db892db689215c068`
- captureTime: `2026-09-01T21:44:44+08:00`
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
| complete-assessment-runtime-owner-migration, explain-active-path-node-decisions | owner | assessment | shared-owner-changes-must-be-sequenced-before-simplification |
| complete-assessment-runtime-owner-migration, move-assessment-and-personalization-evidence-adapters-to-domain-owners | path | src/features/assessment/public-api.ts | overlapping-active-changes-must-not-claim-the-same-deletion-set |
| complete-assessment-runtime-owner-migration, retire-adaptive-business-ownership-and-lib-entrypoints | owner | assessment | shared-owner-changes-must-be-sequenced-before-simplification |
| complete-assessment-runtime-owner-migration, simplify-personalization-learner-state | owner | assessment | shared-owner-changes-must-be-sequenced-before-simplification |
| complete-assessment-runtime-owner-migration, simplify-personalization-path-assembly | owner | assessment | shared-owner-changes-must-be-sequenced-before-simplification |
| explain-active-path-node-decisions, move-assessment-and-personalization-evidence-adapters-to-domain-owners | owner | assessment | shared-owner-changes-must-be-sequenced-before-simplification |
| explain-active-path-node-decisions, retire-adaptive-business-ownership-and-lib-entrypoints | path | src/features/adaptive/adaptive-path-journey-contracts.ts; src/lib/adaptive-path-correction-decisions.ts | overlapping-active-changes-must-not-claim-the-same-deletion-set |
| explain-active-path-node-decisions, simplify-personalization-learner-state | owner | assessment | shared-owner-changes-must-be-sequenced-before-simplification |
| explain-active-path-node-decisions, simplify-personalization-path-assembly | deletion-set | src/lib/adaptive-* | overlapping-active-changes-must-not-claim-the-same-deletion-set |
| move-assessment-and-personalization-evidence-adapters-to-domain-owners, retire-adaptive-business-ownership-and-lib-entrypoints | owner | assessment; personalization | shared-owner-changes-must-be-sequenced-before-simplification |
| move-assessment-and-personalization-evidence-adapters-to-domain-owners, simplify-personalization-learner-state | deletion-set | src/features/personalization/learner-state/ | overlapping-active-changes-must-not-claim-the-same-deletion-set |
| move-assessment-and-personalization-evidence-adapters-to-domain-owners, simplify-personalization-path-assembly | owner | assessment; personalization | shared-owner-changes-must-be-sequenced-before-simplification |
| retire-adaptive-business-ownership-and-lib-entrypoints, simplify-personalization-learner-state | owner | assessment; personalization | shared-owner-changes-must-be-sequenced-before-simplification |
| retire-adaptive-business-ownership-and-lib-entrypoints, simplify-personalization-path-assembly | path | src/lib/adaptive-planning/ | overlapping-active-changes-must-not-claim-the-same-deletion-set |
| simplify-personalization-learner-state, simplify-personalization-path-assembly | owner | assessment; personalization | shared-owner-changes-must-be-sequenced-before-simplification |

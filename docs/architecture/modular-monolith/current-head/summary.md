# Current-head consolidation delta

- schemaVersion: `act-architecture-current-head-delta/v1`
- sourceCommit: `e167eaacea35f353391dc37398d2649e795a4b83`
- sourceTree: `8228900888092cde8ed3ef50cb2bd61fa0714315`
- captureTime: `2026-09-01T22:54:02+08:00`
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
| retirement | 32 | 0 | 0 | 0 | 32 |
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
| complete-assessment-runtime-owner-migration, move-assessment-and-personalization-evidence-adapters-to-domain-owners | path | src/features/assessment/public-api.ts | overlapping-active-changes-must-not-claim-the-same-deletion-set |
| explain-active-path-node-decisions, move-assessment-and-personalization-evidence-adapters-to-domain-owners | owner | personalization | shared-owner-changes-must-be-sequenced-before-simplification |
| explain-active-path-node-decisions, retire-adaptive-business-ownership-and-lib-entrypoints | path | src/features/adaptive/adaptive-path-journey-contracts.ts; src/lib/adaptive-path-correction-decisions.ts | overlapping-active-changes-must-not-claim-the-same-deletion-set |
| explain-active-path-node-decisions, simplify-personalization-learner-state | owner | personalization | shared-owner-changes-must-be-sequenced-before-simplification |
| explain-active-path-node-decisions, simplify-personalization-path-assembly | deletion-set | src/lib/adaptive-* | overlapping-active-changes-must-not-claim-the-same-deletion-set |
| move-assessment-and-personalization-evidence-adapters-to-domain-owners, retire-adaptive-business-ownership-and-lib-entrypoints | owner | personalization | shared-owner-changes-must-be-sequenced-before-simplification |
| move-assessment-and-personalization-evidence-adapters-to-domain-owners, simplify-personalization-learner-state | deletion-set | src/features/personalization/learner-state/ | overlapping-active-changes-must-not-claim-the-same-deletion-set |
| move-assessment-and-personalization-evidence-adapters-to-domain-owners, simplify-personalization-path-assembly | owner | personalization | shared-owner-changes-must-be-sequenced-before-simplification |
| retire-adaptive-business-ownership-and-lib-entrypoints, simplify-personalization-learner-state | owner | personalization | shared-owner-changes-must-be-sequenced-before-simplification |
| retire-adaptive-business-ownership-and-lib-entrypoints, simplify-personalization-path-assembly | path | src/lib/adaptive-planning/ | overlapping-active-changes-must-not-claim-the-same-deletion-set |
| simplify-personalization-learner-state, simplify-personalization-path-assembly | owner | personalization | shared-owner-changes-must-be-sequenced-before-simplification |

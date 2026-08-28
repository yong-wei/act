# Handoff

Change: `define-resource-identity-and-generated-registry-index`
Issue: #1589
Public API: `src/features/knowledge/resource-index/public-api.ts`
Contract: `resource-registry-index/v1`
Generator: `resource-registry-index.v1`

## Index identity

Call `buildResourceRegistryIndex(adapters)` or `getLiveResourceRegistryIndex()`.
The returned `RegistryIndex.identity` hashes generator version, adapter captures,
entry identity keys, and launcher contracts. `digest` hashes the canonical entry
body. Same inputs are byte-identical via `serializeResourceRegistryIndex`.

Live capture adapters:

1. `render-metadata` owner `resource-registry-metadata`
2. `published-artifact` owner `published-artifact-none-declared` (explicitly empty;
   does not scan `runtime-resource-projections.jsonl`)

Do not treat index membership as path eligibility, formal binding, qualification,
or activation.

## For `separate-resource-eligibility-from-release-activation`

Feed `evaluateResourceEligibility(context, resourceIndexEntry)` from
`IndexedResourceEntry` plus existing ResourceNode/audit and release readers.
Do not activate that evaluator in this change. Keep `OPTIONAL`/`NONE` diagnostic.

## For `consolidate-versioned-knowledge-surface-read-contracts`

Bind knowledge-surface responses to `RegistryIndex.identity` when a resource
block is present. Omit mismatched optional card/media with the descriptor
`availability` / `availabilityCode`. Do not activate `readKnowledgeSurface` here.

## For `retire-superseded-resource-governance-entrypoints`

Retirement of `getRegisteredResourceMetadata` callers, ResourceNode read
entrypoints, and derived projections requires an independent denominator and
rollback evidence. This change only migrated `GET /api/resources/[id]` fallback.
Source owners listed in `migration-ledger.md` stay.

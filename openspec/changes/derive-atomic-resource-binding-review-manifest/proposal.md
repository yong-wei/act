## Why

The dated audit records knowledge-reference and resource-endpoint counts, but those counts are versioned evidence, endpoint ownership changes with identity decisions, and container coverage must not become a second binding truth.

## What Changes

- Inventory atomic resources separately from derived container summaries.
- Derive review candidates using the four canonical values `teaches`, `practices`, `assesses`, and `references`; legacy explaining semantics map to `teaches`.
- Distinguish all twelve entity types and required atomic split forms, and keep unresolved boundaries as incomplete review items.
- Emit exact future-child records with item IDs, owner and endpoint blocks, dependencies, and source digests; fail closed on ambiguous or stale endpoint signatures.
- Use only current authoring/resource truth and current published binding comparison; do not inherit learner-dataset privacy or reconciliation work from the inventory.

## ADR 0045 Boundary

Historical facts/events, learner-derived datasets, completed paths, evidence deduplication, and backfill are out of scope. Resource candidates do not inspect or reconcile learner rows.

## Capabilities

### New Capabilities

- `atomic-resource-binding-review-manifest`: defines atomic resource, container-summary, role-candidate, external-identity isolation, and exact review-queue contracts.

### Modified Capabilities

- None.

## Impact

- Produces an offline resource-binding review queue only.
- Does not modify TeachingResource, resource registry metadata, course content, Prisma, learning evidence, or runtime projections.

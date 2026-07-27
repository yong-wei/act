## Why

After indivisible identity equivalence components receive one owner, exact-name or reviewed-alias cross-block presence is a partition failure, while near-similar evidence between distinct components requires a review queue.

## What Changes

- Hard-fail exact-name and reviewed-alias component leakage, and derive an exhaustive cross-block near-similar review queue from frozen manifests.
- Record exact involved item IDs, owner and endpoint blocks, conflict class, evidence references, dependencies, and source digests.
- Emit stable future-child manifest records without approving merge, split, rename, archive, or canonical identity outcomes.
- Fail closed on unowned, multiply owned, placeholder, or stale-digest conflicts.

## Capabilities

### New Capabilities

- `cross-block-identity-review-manifest`: defines the exact cross-block identity-conflict queue and future-child records.

### Modified Capabilities

- None.

## Impact

- Produces an offline review queue consumed by relation, resource, and final validation work.
- Does not change canonical IDs, semantic names, historical mappings, or production data.
## ADR 0045 Boundary

Cross-block identity review may use current truth and reviewed active legacy mappings only. Historical facts/events and learner-derived state cannot create, prioritize, or resolve conflicts.

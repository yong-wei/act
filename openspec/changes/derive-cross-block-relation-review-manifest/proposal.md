## Why

The dated audit and prototype record raw, deduplicated, and provisional cross-block counts, but ownership can change when identities move. Those numbers remain versioned evidence; a truthful queue can only be derived after upstream manifests freeze.

## What Changes

- Derive an exhaustive review queue for cross-block relation adjudication units from frozen owner and identity-conflict manifests.
- Preserve source relation IDs and typed endpoint signatures referencing candidate component IDs, without claiming canonical endpoint completion.
- Distinguish `contains`, `prerequisite`, and `association` candidates without approving type, direction, directness, compatibility, or evidence sufficiency.
- Fail closed on stale endpoints, duplicate queue units, placeholders, or missing ownership.

## Capabilities

### New Capabilities

- `cross-block-relation-review-manifest`: defines the exact cross-block relation review queue and future-child records.

### Modified Capabilities

- None.

## Impact

- Produces an offline queue only; no relation is written to authoring, runtime, or database projections.
- Does not create second-stage relation-review changes before exact records are frozen.
## ADR 0045 Boundary

Relation review derives only from current candidate semantics and current published-graph comparison. Historical facts/events and learner-derived state cannot propose or validate relations.

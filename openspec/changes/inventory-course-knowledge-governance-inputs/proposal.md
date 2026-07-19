## Why

The governance preparation series needs one reproducible inventory before any identity or ownership work can begin. The inventory must bind the repository inputs described by `docs/contexts/course-knowledge-base/CONTEXT.md`, the ADR 0015-0044 files indexed by `docs/adr/README.md`, and `docs/knowledge-graph-current-state-audit-2026-07-18.md` without turning observed records into semantic judgments.

## What Changes

- Define a machine-readable input inventory covering the complete authoring, projection-evidence, historical-reference, learner-dataset, consumer, writer, loader, and seed/sync closure.
- Reconcile dated audit baselines as versioned evidence with explicit derivation and expected/observed drift, never as permanent specification constants.
- Freeze separate governance contract, source snapshot, upstream manifest, per-source, and aggregate digests.
- Explicitly exclude identity grouping, merge/split judgment, domain assignment, relation approval, and resource-binding approval.

## Capabilities

### New Capabilities

- `knowledge-governance-input-inventory`: defines the complete, digest-bound inventory contract for course-knowledge governance inputs.

### Modified Capabilities

- None.

## Impact

- Produces offline governance evidence only; no production code, runtime data, authoring data, database, or GitHub object changes.
- Becomes the sole upstream input contract for identity candidates and the controlled domain vocabulary.

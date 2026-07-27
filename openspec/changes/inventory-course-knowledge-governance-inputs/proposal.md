## Why

The rebuild needs a reproducible inventory, but ADR 0045 limits that inventory to current governed truth and active references. Historical learner facts and derived state must not become an accidental migration program.

## What Changes

- Inventory the current formal course and reviewed scope anchors; current authoring content, cards, media, and resources; current published graph and binding comparison; active knowledge references; and reviewed active legacy-to-canonical mappings.
- Define active references as course, resource, progress, note, and incomplete-path references still read or continued at cutover.
- Reject historical facts, events, completed paths, learner-derived state, decoder/lineage inputs, and writer catalogs as outside this series; generate no diagnostic catalog for them.
- Emit deterministic manifests and drift evidence without changing any source or approving semantic decisions.

## Capabilities

### New Capabilities

- `knowledge-governance-input-inventory`: defines the bounded, read-only inventory consumed by the remaining preparation changes.

### Modified Capabilities

- None.

## Impact

- Adds only a read-only manifest CLI, reports, and tests.
- Does not generate, consume, validate, replay, reinterpret, deduplicate, migrate, or backfill historical learner data; compatibility is limited to reading an original legacy revision or snapshot.
- Does not modify authoring, runtime, Prisma, production data, or GitHub state.

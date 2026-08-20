## Why

A rebuilt v0.22 domain catalog and its projections do not prove that ACT can
switch production coherently. Production today still mixes a v0.9 domain
display catalog with newer Authority data, which is exactly the mixed state a
composite cutover forbids. Before any activation, a dedicated qualification
stage must verify the whole `control-theory-engineering-v0.22` composite
release envelope — one immutable version set fixed by the Aggregate's
Component Manifest — without moving any production selector.

## What Changes

- Pin one locked v0.22 composite release envelope: Aggregate v0.22,
  Integration v0.20, Chinese terminology component v0.5, Schema 0.3.0 with a
  hash identical to the already-integrated v0.18 Schema, Projection Profile,
  tag index, and every remaining component the Component Manifest declares.
- Audit the candidate values of all five production selectors — Authority,
  Teaching Projection, prerequisites, Authority domain shard/catalog, and
  shared consumer activation — and fail qualification on any mixed-version
  combination such as v0.22 Authority over a v0.9 or v0.18 domain catalog.
- Verify domain catalog membership completeness from materialized many-to-many
  membership with no stale v0.9 members, Chinese display coverage, and
  teaching projection references resolving to v0.22 canonical objects, with
  missing teaching coverage reported as a gap rather than a blocker.
- Prove Authority domain shard rebuild reproducibility and preserve restorable
  rollback evidence for the previous production composite release envelope.
- Emit a qualification verdict that marks the candidate auditable only; it
  MUST NOT itself constitute or trigger the production composite cutover.

## Capabilities

### New Capabilities

- `actkg-v022-cutover-qualification`: produce immutable, non-activating
  evidence that the locked v0.22 composite release envelope is complete,
  coherent across all five production selectors, reproducible, and reversible.

### Modified Capabilities

- None.

## Impact

- Adds envelope manifest audits, selector coherence gates, domain membership
  and display coverage checks, shard rebuild reproducibility proof, rollback
  evidence, and a non-activating qualification verdict.
- Depends on change `rebuild-v022-domain-catalog-and-projections`; part of
  series issue #1441.
- Does not perform the production composite cutover, change any production
  selector, or mirror v0.22 object counts as fixed expectations (v0.22 is not
  yet mirrored locally; counts are read from the envelope at qualification
  time).

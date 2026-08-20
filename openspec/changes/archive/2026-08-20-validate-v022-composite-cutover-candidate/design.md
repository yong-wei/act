## Context

`rebuild-v022-domain-catalog-and-projections` produces the candidate domain
catalog and projections for `control-theory-engineering-v0.22`. Production
selectors still reference older releases, and the current domain display
catalog is still bound to v0.9 — proof that today's state is not a complete
composite cutover. Qualification is the first stage that judges the whole
locked composite release envelope while production remains untouched. v0.22 is
not yet mirrored locally, so object counts cannot be hard-coded; they are
derived from the envelope's own manifest at qualification time.

## Goals / Non-Goals

**Goals:**

- Lock and verify one v0.22 composite release envelope end to end.
- Prove all five production selector candidate values reference that same
  envelope and reject every mixed-version combination.
- Prove domain membership, Chinese display, and teaching reference behavior,
  plus shard rebuild reproducibility and rollback evidence.
- Emit a candidate-auditable verdict that carries no activation authority.

**Non-Goals:**

- Performing the production composite cutover or moving any production
  selector.
- Runtime auto-following of a "latest" release.
- Treating incomplete teaching projection coverage as a cutover blocker.

## Decisions

### 1. Qualify one locked composite release envelope, not per-component versions

The qualification input is the single envelope fixed by the Aggregate v0.22
Component Manifest: Aggregate v0.22, Integration v0.20, Chinese terminology
v0.5, Schema 0.3.0, Projection Profile, tag index, and all remaining declared
components. Any component resolved outside the manifest, or picked as a
separate "latest", invalidates the run before behavioral checks.

### 2. Schema identity is verified by hash, not re-adapted

v0.22 keeps `actkg-public-bundle/2` and Schema 0.3.0 with a hash equal to the
v0.18 Schema already integrated by ACT. Qualification asserts that hash
equality instead of designing a new major-version adapter, and fails if the
hash differs from the recorded v0.18 value.

### 3. Selector coherence is a single joint gate

The candidate values of all five production selectors — Authority, Teaching
Projection, prerequisites, Authority domain shard/catalog, and shared consumer
activation — are audited together against the envelope identity. One failing
or mixed selector (for example v0.22 Authority with a v0.9 or v0.18 domain
catalog) fails the whole qualification; there is no per-selector partial pass.

### 4. Membership is materialized many-to-many; counts come from the envelope

Domain catalog completeness is judged against the envelope's own domain
catalog: every declared many-to-many membership must be materialized, and no
stale v0.9 member may remain readable through the candidate catalog. Expected
domain and member counts are read from the envelope at run time because v0.22
has no local mirror yet.

### 5. Reference closure blocks; teaching enrichment coverage does not

Teaching projection references must resolve to v0.22 canonical objects, and
Chinese display coverage is measured against the terminology v0.5 component.
Dangling references block; v0.22 objects that simply lack teaching relations
are reported as coverage gaps and do not block, matching the confirmed
boundary that teaching coverage does not gate Authority cutover.

### 6. Reproducibility and rollback are evidence, not activation

Two independent Authority domain shard rebuilds from the same envelope must
match. A snapshot of the previous production composite release envelope must
be preserved and demonstrably restorable. Both are recorded as evidence for a
later activation change; a passing verdict still leaves every production
selector byte-identical to its pre-run value.

## Risks / Trade-offs

- Without a local v0.22 mirror, some expectations are self-referential to the
  envelope; mitigated by verifying manifest hashes and cross-component
  identity rather than absolute counts.
- A joint five-selector gate is stricter than per-selector checks and may
  block on a single lagging selector — accepted, because mixed production
  state is the primary failure mode this change exists to prevent.

## Migration Plan

1. Lock the v0.22 composite release envelope and verify Component Manifest
   completeness and identity, including the Schema 0.3.0 hash equality.
2. Audit five-selector candidate coherence, domain membership, Chinese
   display, and teaching reference resolution.
3. Prove shard rebuild reproducibility and preserve restorable rollback
   evidence for the previous production envelope.
4. Emit the non-activating qualification verdict; production activation
   remains a separate follow-up change.

## Open Questions

- None. Production activation evidence is deliberately deferred to the
  separate cutover change in series issue #1441.

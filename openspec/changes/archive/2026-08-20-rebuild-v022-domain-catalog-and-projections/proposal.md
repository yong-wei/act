## Why

ACT's domain display catalog is still bound to `control-theory-engineering-v0.9`
with only a handful of manually classified members, which is why each domain on
/knowledge shows only one or two reviewed objects. The v0.22 composite candidate
produced by `import-actkg-v022-composite-candidate` locks Aggregate
`control-theory-engineering-v0.22`, Integration v0.20, Chinese terminology
component v0.5, and the remaining declared components in one Component Manifest.
The next production switch is a composite cutover: the domain catalog, the
zh-CN display projection, and the Teaching Projection must all be rebuilt
against that same envelope beforehand, in candidate space, so no mixed-version
production state can arise.

## What Changes

- Rebuild the Authority domain display catalog against the v0.22 composite
  candidate: domain entries and their count derive from the v0.22 domain
  catalog data and are never hard-coded in code or spec; membership is
  many-to-many with every published concept in at least one domain; the domain
  vocabulary stays a flat controlled top-level list with no sub-domain
  hierarchy. The stale v0.9 catalog binding is replaced as the candidate
  membership source.
- Rebuild the Chinese display projection from the v0.22 Chinese terminology
  component v0.5, preserving the fail-closed boundary that never exposes
  internal IDs, hashes, release strings, or machine slugs to humans.
- Rebase the ACT Teaching Projection and prerequisite relations to v0.22
  canonical objects with identity-evidence-only mapping. Missing teaching
  coverage does not block the Authority cutover; newly published teaching
  relations can be added incrementally later.
- Bind all rebuilt outputs to one pinned v0.22 composite release envelope.
  Everything stays INACTIVE; no production selector moves.

## Capabilities

### New Capabilities

- `actkg-v022-display-projections`: bind the rebuilt domain catalog, zh-CN
  display projection, and teaching-projection candidates to one pinned v0.22
  composite release envelope while keeping candidate and production strictly
  separated.

### Modified Capabilities

- `authority-domain-display-catalog`: replace the hard-coded eight-domain
  vocabulary with release-data-driven domain entries and require full
  published-concept domain coverage.
- `authority-localized-label-projection`: make the sealed terminology
  index-count admission invariant release-bound instead of pinned to the
  v0.18 count.
- `act-teaching-projection-rebase`: repin the rebase denominator, successor
  mapping, output binding, database observation, and pointer byte-stability
  requirements from the v0.18 candidate to the v0.22 composite candidate.

## Impact

- Affects domain catalog artifacts and validation, label-resolver release
  bindings, Teaching Projection and prerequisite rebase tooling, candidate
  receipts, and related governance tests.
- Depends on change `import-actkg-v022-composite-candidate` (series issue
  #1441) for the admitted inactive v0.22 composite candidate.
- Does not activate anything: candidate import and production activation remain
  two phases, and every production selector keeps its current bytes.

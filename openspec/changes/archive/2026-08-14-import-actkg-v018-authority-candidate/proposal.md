## Why

A supported v2 parser is not an Authority release. ACT needs a complete,
replayable v0.18 intake that proves the exact public package and materializes an
inactive candidate before any teaching or production decision. The v0.17 to
v0.18 release diff cannot substitute for the full v0.9 to v0.18 migration audit.

## What Changes

- Mirror the complete stable `control-theory-engineering-v0.18` Bundle from its
  fixed publication tag into ACT's immutable authoring release boundary.
- Validate the pinned Bundle, Schema, Release, component, Projection Profile,
  multilingual-label, checksum, and artifact identities through the new v2
  adapter before importing anything.
- Import the full runtime projection as a staged Authority candidate and
  materialize a content-addressed snapshot containing 6,843 visible objects,
  2,811 published relations, and the 1,909-row Chinese terminology index.
- Produce a v0.9 to v0.18 identity and relation impact report, preserve the full
  v0.18 source package, and prove two clean rebuilds are byte-identical.
- Keep candidate creation idempotent and leave Authority, Teaching Projection,
  prerequisite, Authority domain-shard, consumer-activation, and production
  marker pointers unchanged.

## Capabilities

### New Capabilities

- `actkg-v018-authority-candidate`: mirror, validate, import, and deterministically
  materialize the pinned v0.18 public Bundle as an inactive ACT Authority snapshot.

### Modified Capabilities

- None.

## Impact

- Adds immutable v0.18 release inputs, candidate snapshot artifacts, intake
  receipts, complete-delta evidence, and deterministic rebuild tests.
- Depends on `admit-actkg-public-bundle-v2`.
- Does not activate the candidate, rebuild teaching semantics, or deploy it.

## Why

ACT production currently selects the v0.18 composite state, while the latest
stable ActKG Aggregate is `control-theory-engineering-v0.22`. A future cutover
must bind every production selector to one composite release envelope, so ACT
first needs a complete, replayable v0.22 intake that mirrors the pinned
Aggregate together with its Component Manifest and materializes an inactive
candidate before any teaching or production decision. Per-component "latest"
picking cannot substitute for the manifest-locked envelope.

## What Changes

- Mirror the complete stable `control-theory-engineering-v0.22` Aggregate from
  its pinned publication into ACT's immutable release boundary, together with
  its Component Manifest that locks Integration v0.20, the Chinese terminology
  component v0.5, the Schema, the Projection Profile, the tag index, and every
  other declared component. The composite release envelope is the import unit.
- Validate the pinned envelope through the already-admitted
  `actkg-public-bundle/2` adapter: v0.22 keeps Schema `0.3.0` with the same
  schema hash as the admitted v0.18, so no new schema adapter is designed, but
  explicit v0.22 registration, mirror, validation, and admission evidence MUST
  be produced.
- Import the manifest-declared runtime Projection membership as a staged
  Authority candidate and materialize a content-addressed snapshot. v0.22 has
  no local mirror yet, so membership counts are resolved and recorded at intake
  rather than hard-coded.
- Produce a v0.18 to v0.22 identity and relation impact report, preserve the
  full v0.22 source envelope, and prove two clean rebuilds are byte-identical.
- Keep candidate creation idempotent and leave Authority, Teaching Projection,
  prerequisite, Chinese-display, Authority domain catalog/shard,
  consumer-activation, and production marker selectors unchanged.

## Capabilities

### New Capabilities

- `actkg-v022-authority-candidate`: mirror, validate, import, and deterministically
  materialize the pinned v0.22 composite release envelope as an inactive ACT
  Authority snapshot.

### Modified Capabilities

- None.

## Impact

- Adds immutable v0.22 envelope inputs, candidate snapshot artifacts, intake
  receipts, v0.18 to v0.22 delta evidence, and deterministic rebuild tests.
- Depends on no other new change; this is the entry change of series issue
  #1441 (ActKG v0.22 composite cutover). It reuses the already-archived
  `admit-actkg-public-bundle-v2` and `import-actkg-v018-authority-candidate`
  capabilities as its baseline.
- Does not activate the candidate, rebuild teaching semantics, rebuild the
  Authority domain catalog, or deploy.

## Why

ACT production currently consumes `control-theory-engineering-v0.9` through
`actkg-public-bundle/1` and CTKG Schema `0.2.0`. ActKG's stable
`control-theory-engineering-v0.18` release uses `actkg-public-bundle/2`, Schema
`0.3.0`, Projection v3, a multilingual label index, and a projection-profile
manifest. The existing adapter correctly rejects that package. Accepting it by
loosening v1 checks would erase the reviewed protocol boundary and could make
historical v0.9 imports nondeterministic.

## What Changes

- Add a separate v2 compatibility registry, validator, routed result, and
  normalized validated-bundle type while leaving the v1 loader and tests intact.
- Pin the stable v0.18 publication tag, source tag and commit, raw Manifest and
  `SHA256SUMS` hashes, Bundle digest, Schema identity, Release identity, and all
  required Artifact contracts.
- Validate the v2 component manifest, Projection Profile manifest,
  `multilingual-label-index`, Projection v3 artifacts, closure, privacy, and
  the declared 7,061 release nodes / 6,843 runtime nodes / 2,811 relations /
  1,909 terminology assertions.
- Reject unknown required roles, profile drift, cross-artifact identity drift,
  unsupported v2 packages, and any attempt to fall back from a failed v2 route
  to v1 or the historical adapter.

## Capabilities

### New Capabilities

- `actkg-public-bundle-v2-compatibility`: strictly validate and normalize the
  pinned ActKG public Bundle v2 contract without making it current Authority.

### Modified Capabilities

- `actkg-public-bundle-compatibility`: dispatch Manifest-declared v1 and v2
  packages to separate fail-closed adapters while preserving v1 behavior.

## Impact

- Affects `scripts/actkg-release/` compatibility routing, types, validators,
  contract fixtures, and focused import tests.
- Does not import v0.18, write an Authority snapshot, change any current
  pointer, infer compatibility from version strings, or modify ActKG data.

## Context

The current router recognizes a standard Bundle by `bundle-manifest.json` and
then sends it to the v1 adapter. Its reviewed registry accepts only
`actkg-public-bundle/1`, CTKG Schema `0.2.0`, Projection `0.2`, and the v1
artifact vocabulary. This rejection boundary must remain valid for every
historical package.

The first admitted v2 package is fixed to these upstream identities:

- publication tag `control-theory-engineering-v0.18` at
  `f7b9155114b8449542f4f15335cfbed30570aef8`;
- source tag `control-theory-engineering-v0.18-source-r1` at source commit
  `08f732c50450d991841f382edf75394433b00f53`;
- Bundle `ctb:control-theory-engineering-v0.18:r1`, digest
  `9caf1083ae7a13c5122546e7ff7cbf8b6b0f463438444088d9c80227624866cd`;
- Manifest raw hash
  `4da43f92e44f122b98b8dc93021e02c0b8d146440f7c155392fa7cc234e076ae`;
- `SHA256SUMS` raw hash
  `2e4a97d7586931176c480eb544ec18fab46b8c07beda8fcc21e7418b5428f903`;
- Schema `0.3.0`, raw hash
  `4850ed2e4887f7b6a4f2a08f3eb786f82ef757170befef0f3f2dbf6dc9f6cb28`;
- Release hash `73fdb59ccf8748e3d4a8625d3e4d1499de14d7182804d18c4e6c9b6eb54b7c60`.

## Goals / Non-Goals

**Goals:**

- Validate the exact public Bundle v2 package through a separate reviewed registry.
- Preserve every v1 and legacy validation branch byte-for-byte in behavior.
- Normalize v2 Projection v3 and terminology artifacts for downstream candidate import.

**Non-Goals:**

- Generic acceptance of future Bundle v2 releases or Schema 0.3 hashes.
- Candidate import, Authority activation, label rendering, or teaching rebase.
- Reconstruction or correction of upstream artifacts.

## Decisions

### 1. Route by declared protocol after Manifest integrity parsing

Manifest presence still selects the standard route. A minimal bounded parser
reads the declared contract and dispatches to an explicit v1 or v2 adapter.
Failure in either adapter is terminal; no version fallback is permitted.

### 2. Keep a v2-only compatibility registry

The v2 registry pins the compound Bundle, Schema, Release, component, Artifact,
Projection Profile, and raw-byte identities above. The existing v1 constants,
artifact list, validated type, and tests remain untouched except for router
tests proving correct dispatch.

### 3. Validate new artifacts as semantic inputs

`projection-profiles.json` and `multilingual-label-index.jsonl` are required
semantic artifacts. Every label row must satisfy
`actkg-multilingual-label-index/1`, resolve to a runtime projection entity, and
bind a declared terminology assertion. The runtime profile must be the exact
v0.18 Projection v3 profile and agree with projection IDs and hashes.

### 4. Emit a versioned normalized result

The v2 result carries raw artifacts plus separately typed release, projection,
profile, label, component, and statistics records. Downstream code must branch
on the validated protocol version rather than treating the new fields as
optional additions to the v1 type.

## Risks / Trade-offs

- Exact pinning requires a new review for the next Bundle or Schema identity;
  this is intentional.
- Duplicated v1/v2 validation structure costs code, but prevents a broad shared
  parser from weakening historical contracts.

## Migration Plan

1. Add failing v2 fixtures and v1 non-regression tests.
2. Add the v2 registry, schemas, typed validator, and protocol dispatch.
3. Validate the fixed upstream package and negative drift cases.
4. Leave all import and current-pointer paths unchanged.

## Open Questions

- None. Future v2 releases require explicit registry additions through a later change.

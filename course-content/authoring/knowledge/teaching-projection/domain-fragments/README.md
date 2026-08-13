# Domain Teaching Fragments (#1370)

Append-only, immutable domain shards of reviewed core-node memberships and direct `ACT_TEACHING` relations.

- **Builder**: `src/lib/teaching-projection/domain-fragments/`
- **Schemas**: `schemas/domain-fragment.schema.json`, `schemas/composed-manifest.schema.json`
- **First published fragment** (non-fixture, live Authority-bound):
  - `first-fragment.authoring.json`
  - `first-fragment.json`
  - `composed-manifest.json`
- **Foundation three-domain increment** (`foundation-three-domain-v1`, #1371; does not rewrite the first fragment):
  - `foundation-three-domain-v1.source.json`
  - `foundation-three-domain-v1.worklist.json`
  - `foundation-three-domain-v1.authoring.json`
  - `foundation-three-domain-v1.json`
  - `foundation-three-domain-v1.coverage.json`
  - `fixtures/foundation-three-domain-two-fragment-manifest.json` (two-fragment validation fixture only; not a runtime current pointer)
- **Fixtures**: `fixtures/` verification samples only
- **Source inventory**: `../prerequisites/inventory/` (translated without semantic change)

## Canonical Authority envelope

Builders resolve Authority nodes only from a sealed envelope. The envelope always includes:

- complete binding: `releaseId`, `releaseSetId`, `snapshotId` (`snap-${snapshotHash}`), `snapshotHash`
- `sourceDatasetHash`
- `captureRevision` and `authoringRevision`
- canonical `nodeIndexDigest` recomputed from normalized node identities

Caller-supplied node-index or Authority digests are never trusted; they may only match the recomputed members.

## Source inventory digest

`sourceInventoryDigest` is computed from the normalized actual source members. A precomputed caller digest is never accepted as the stored value.

## Composition and activation

Binding and digests are recomputed through build, translate, persisted fragment, composition and activation. Cross-fragment equivalent edges use semantic identity excluding domain/evidence; domain keys and evidence are deterministically unioned and the edge digest is recomputed. A true identity conflict fails closed.

Activation accepts an independently supplied expected immutable binding/digest, recomputes artifact identity, counts and binding before pointer emission, and leaves the prior pointer unchanged on any mismatch.

## Coverage

Domain teaching coverage is `available` | `partial` | `empty` | `unavailable` and never blocks Engineering Authority activation or engineering relation browsing.

## Relation presentation

Consumers resolve presentation from the registered runtime contract (`act-teaching-relation-presentation/v1`) by published `relationType`. There is no per-release frontend allowlist of edge IDs.

# Domain Teaching Fragments (#1370)

Append-only, immutable domain shards of reviewed core-node memberships and direct `ACT_TEACHING` relations.

- **Builder**: `src/lib/teaching-projection/domain-fragments/`
- **Schemas**: `schemas/domain-fragment.schema.json`, `schemas/composed-manifest.schema.json`
- **First published fragment** (non-fixture, live Authority-bound):
  - `first-fragment.authoring.json`
  - `first-fragment.json`
  - `composed-manifest.json`
- **Generation 2** (classical-control increment, immutable alongside generation 1):
  - `generation-2/authority-source.json` identifies the complete node index
    extracted from the same pinned Authority snapshot.
  - `generation-2/foundation-fragment.*` reseals the unchanged foundation
    teaching semantics against that complete endpoint universe.
  - `generation-2/foundation-three-domain-fragment.*` reseals the already
    published system-modeling, time-domain and stability increment against the
    same complete endpoint universe.
  - `generation-2/classical-worklist.json` records reviewed and pending
    candidates; engineering-only adjacency stays pending.
  - `generation-2/classical-fragment.*` and `generation-2/composed-manifest.json`
    publish the reviewed classical-control increment and its coverage report.
- **Foundation three-domain increment** (`foundation-three-domain-v1`, #1371; does not rewrite the first fragment):
  - `foundation-three-domain-v1.source.json`
  - `foundation-three-domain-v1.worklist.json`
  - `foundation-three-domain-v1.authoring.json`
  - `foundation-three-domain-v1.json`
  - `foundation-three-domain-v1.coverage.json`
  - `fixtures/foundation-three-domain-two-fragment-manifest.json` (two-fragment validation fixture only; not a runtime current pointer)
- **Modern-control increment** (#1373; two independent empty fragments while admission remains unresolved):
  - `modern-discrete-time-v1.{source,worklist,authoring,json,coverage}.json`
  - `modern-state-space-v1.{source,worklist,authoring,json,coverage}.json`
  - Each worklist keeps the exact node as a `DEFER`/`authority unresolved` candidate with domain-specific CourseCoverage evidence (`issue-1195` for discrete time, `issue-1208` for state space); it is not a denominator member. Range-level deferred/excluded boundary notices carry no synthetic relation endpoint.
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

# Domain Teaching Fragments (#1370)

Append-only, immutable domain shards of reviewed core-node memberships and direct `ACT_TEACHING` relations.

- **Builder**: `src/lib/teaching-projection/domain-fragments/`
- **Schemas**: `schemas/domain-fragment.schema.json`, `schemas/composed-manifest.schema.json`
- **First published fragment** (non-fixture, live Authority-bound):
  - `first-fragment.authoring.json`
  - `first-fragment.json`
  - `composed-manifest.json`
- **Generation 2** (classical-control increment, resealed against the live Authority snapshot):
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
- **Generation 3** (global combination, #1374; resealed against the same live Authority snapshot as generation 2):
  - `generation-3/authority-source.json` and `generation-3/conversion-protocol.json` pin the complete 7476-node live Authority envelope and the closed identity allowlist.
  - `generation-3/upstream-pins.json` records each upstream path, original byte digest, original published/semantic digest, resealed digest and snapshot binding. Shard reseals stay one-to-one. The four collected foundation / classical / modern worklists are pinned as shared multi-source inputs of the empty cross-domain audit, not as extra one-to-one fragments.
  - `generation-3/foundation-fragment.*`, `generation-3/foundation-three-domain-fragment.*` and `generation-3/classical-fragment.*` reseal existing teaching semantics against that envelope.
  - `generation-3/modern-discrete-time.*` and `generation-3/modern-state-space.*` reseal the empty modern shards, keeping unresolved `DEFER` candidates and empty denominators.
  - `generation-3/cross-domain.*` is an empty reviewed fragment: no admissible direct ACT_TEACHING candidate, zero core nodes/relations/denominator.
  - `generation-3/composed-manifest.json` is the unrelaxed global composition.
- **Fixtures**: `fixtures/foundation-three-domain-two-fragment-manifest.json` is the only remaining verification sample (two-fragment composition). Historical first-fragment copies were retired after the live v0.37 rebind.
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

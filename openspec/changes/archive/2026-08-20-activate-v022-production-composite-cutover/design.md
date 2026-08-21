## Context

The latest stable ActKG Aggregate is `control-theory-engineering-v0.22`, whose
Component Manifest locks Integration v0.20, the Chinese terminology component
v0.5, Schema `0.3.0` (same schema hash as the admitted v0.18), the Projection
Profile, and the remaining declared components. Production today is not a
complete composite state: Authority and teaching selectors serve v0.18 while
the Authority domain catalog/shard bindings still resolve v0.9, which is why
each `/knowledge` domain shows only one or two reviewed objects. The deployed
runtime cannot address any other envelope because release and profile
identities are compiled in as v0.18 constants (for example
`src/lib/authority-domain-shards/labels.ts`).

This change carries the last two release actions of series issue #1441: first
publish an envelope-configurable runtime, then perform the composite cutover.
The qualified candidate and its evidence come from
`validate-v022-composite-cutover-candidate`; the human-facing graph
presentation comes from `restore-legacy-domain-graph-presentation`.

## Goals / Non-Goals

**Goals:**

- Publish one immutable runtime revision whose envelope selectors are
  configuration bound to a single qualified composite release envelope.
- Deploy that runtime while production data still serves the current v0.18
  envelope, without touching any production knowledge selector.
- Atomically activate the qualified v0.22 composite release envelope across all
  five production selectors in one fail-closed transaction.
- Preserve a previous-envelope snapshot and a five-selector rollback action
  usable within the rollback window.
- Verify `/knowledge` serves v0.22 domains with full reviewed membership,
  intact Chinese display coverage, and no internal identifiers.

**Non-Goals:**

- Importing, rebuilding, or re-qualifying the v0.22 candidate (owned by
  `import-actkg-v022-composite-candidate` and
  `validate-v022-composite-cutover-candidate`).
- Redesigning the graph UI (owned by
  `restore-legacy-domain-graph-presentation`).
- Designing a new schema adapter — v0.22 keeps `actkg-public-bundle/2` and the
  admitted Schema `0.3.0` hash.
- Deleting or retiring v0.9/v0.18 artifacts.

## Decisions

### 1. Selector identities move from source constants to bound configuration

The runtime reads Authority release, Projection Profile, domain shard/catalog,
and label-overlay identities from one envelope-selector configuration that is
itself pinned to a named, qualified composite release envelope. Runtime code
never scans for or follows "latest"; an unknown or partially resolved envelope
is a startup/readiness failure, not a silent fallback. This removes the
hard-coded `ctr:release:control-theory-engineering-v0.18` pins.

### 2. Runtime publication and data activation stay separate release actions

The runtime release deploys with its bound configuration still selecting the
current v0.18 envelope, proving the configurable runtime serves the existing
production state byte-for-byte before any data movement. Shadow reads against
the staged v0.22 candidate are controlled and never mutate shared selectors.
Candidate import (already done), runtime publication, and production
activation are three separately auditable actions.

### 3. One write-ahead transaction advances all five selectors

Under one exclusive production lock, the activation seals and re-reads a
write-ahead journal recording the qualified v0.22 targets and the complete
previous-envelope predecessors, then advances Authority, Teaching Projection,
prerequisite, Authority domain shard/catalog, and finally the shared
consumer-activation pointer. The consumer-activation pointer is the only READY
commit point. Any comparison failure, unmovable selector, or selector still
resolving an older release aborts the transaction and leaves production fully
on the previous envelope — mixed state is never a legal outcome.

### 4. Rollback restores the five-selector snapshot as one unit

Before the forward switch, the previous-envelope snapshot (the recorded
pre-activation identities of all five selectors) is sealed and the rollback
path is exercised against staged artifacts. Within the rollback window, one
rollback action restores all five selectors together, constrained to pointers
whose current identities match the journaled v0.22 targets; unexpected
concurrent identities stop compensation and demand operator intervention.
After activation settles, v0.9 and v0.18 are reachable only through read-only
history entries and rollback evidence, never through normal reads.

### 5. Post-activation verification uses envelope evidence, not fixed counts

Verification compares `/knowledge` domain membership against the reviewed
membership recorded in the qualification evidence of the activated envelope —
no v0.22 object counts are hard-coded in specs, config, or checks. It also
proves Chinese preferred/fallback display coverage and the absence of
learner-visible object IDs, relation IDs, release/snapshot/activation names,
version hashes, or internal enums. Any failed observation triggers the
journaled rollback rather than leaving a partially verified state current.

## Risks / Trade-offs

- A committed activation followed by a failed observation causes a second
  atomic transaction back to the previous envelope; this is accepted as safer
  than any mixed state.
- Configuration-bound selectors add one indirection to every envelope read;
  mitigated by failing closed at startup when the bound envelope is
  incomplete, so misconfiguration cannot reach request paths.
- Retaining v0.9, v0.18, and v0.22 artifacts increases storage, but keeps
  rollback independent of network availability.

## Migration Plan

1. Replace hard-coded v0.18 selector constants with envelope-bound
   configuration; freeze, build, and gate the runtime revision.
2. Deploy the runtime with the v0.18 envelope still selected; verify current
   behavior and controlled v0.22 shadow reads; seal the runtime receipt.
3. Re-verify the qualification handoff, exercise rollback, and run the
   five-selector write-ahead activation to the v0.22 envelope.
4. Verify `/knowledge` membership, Chinese display, identifier hygiene, and
   consumer health; on failure, roll back all five selectors together.
5. Seal the activation (or rollback) receipt; move v0.9/v0.18 access to
   read-only history and rollback evidence.

## Open Questions

- The rollback-window duration and any later retirement of v0.18 artifacts are
  operational parameters set at activation time and recorded in the receipt;
  retirement itself requires a separate change.

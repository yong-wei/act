## Context

The active Authority adapter currently obtains the full canvas payload and only then limits visible nodes. The old workspace already established root-first and domain-shard patterns, but the active source needs an Authority-aware identity that combines engineering selection, display catalog and optional Teaching Projection.

## Goals / Non-Goals

**Goals:** deliver root, domain-default, relation-family, one-hop and detail/media shards with deterministic identity and bounded payloads.

**Non-Goals:** change graph facts, choose visual layout, require teaching coverage, or expose full graph access to ordinary users.

## Decisions

1. **Define five shard classes.** `root` contains display domains and counts; `domain-default` contains primary objects plus published teaching skeleton; `relation-family` adds one engineering family; `node-neighborhood` adds a bounded one-hop scope; `node-detail` carries text and media references.
2. **Use a composite version envelope.** Authority activation identity and display catalog version are required; Teaching Projection version is optional. Each response echoes safe version-match booleans externally while opaque values remain internal.
3. **Merge canonical objects once.** The client stores objects by canonical identity and relations by stable layer-aware identity. A secondary domain membership never duplicates an object or resets coordinates.
4. **Fail layers independently.** Invalid Authority or catalog identity blocks the requested shard. Missing or partial teaching data removes only the teaching relation set and returns a coverage state; engineering family requests still succeed.
5. **Keep detail lazy.** Knowledge Card and infograph data are never part of root or domain-default payloads.
6. **Materialize versioned Authority shards at activation.** The active pointer selects one immutable, composite-versioned shard set. Root, domain-default, relation-family and bounded one-hop resolvers read only their matching small artifacts; they never parse `engineering.json` and never fall back to an older or whole-graph artifact. This changes storage and delivery only: Authority and Teaching facts, `engineering-graph`'s null `projectionId`, domain membership and relation direction remain unchanged. Missing, partial, empty or unavailable Teaching data produces an empty teaching layer without blocking valid engineering shards.
7. **Resolve Teaching from the sealed composed artifact.** `DomainTeachingCurrentPointer` selects an immutable composed projection but never embeds relations. Publication verifies its projection identity, Authority binding/digest and cache family against the composed artifact, then materializes the Teaching layer from that artifact. A missing, invalid or independently advanced Teaching pointer never invalidates Authority/catalog shards: stale Teaching relations are removed, coverage becomes unavailable and the public envelope reports `match.teaching=false` until a matching shard set is atomically published. The client preserves engineering state while invalidating only Teaching-bearing domain shards.
8. **Make production cutover the shard pointer writer.** The production cutover plan seals an Authority-domain shard set built from that plan's Authority snapshot and Teaching Projection, including every immutable shard file and its `current.json` target. The cutover state machine treats this as a fifth component: it writes and verifies immutable files before switching the five pointers, and its rollback/recovery restores the shard pointer with the other selected pointers. Rollback and recovery never delete immutable shard sets, because a mutable receipt cannot safely prove creation ownership. The offline materialization CLI remains diagnostic-only; it must not become a post-commit production writer. This is a logical transaction boundary backed by the existing journal, not a claim of multi-file filesystem atomicity.

## Risks / Trade-offs

- [Many small requests add latency] → Permit version-valid summary prefetch and coalesce concurrent identical shard requests.
- [Mixed versions corrupt the graph] → Reject mismatched envelopes before merge and invalidate the affected cache family.
- [Cross-domain expansion grows without bound] → Return boundary references first and require explicit entry or node selection for the adjacent shard.

## Migration Plan

Add endpoints beside the current active canvas endpoint, prove payload and request budgets, migrate the new workspace, then retain full-canvas access only for authorized diagnostics. Rollback returns the UI to the current endpoint without changing selectors.

## Accepted final remediation decisions (2026-08-13)

1. Any shard response whose Authority or catalog identity differs from the
   current workspace aborts the current request generation, clears the
   workspace, and enters controlled unavailable state. Recovery requires an
   explicit new root retry. A Teaching-only identity change removes
   `ACT_TEACHING` relations, coverage, domain-default/detail cache entries and
   their loaded keys while retaining same-Authority engineering objects,
   relations, layout, selection and inspector state. The rule applies equally
   to relation-family, node-neighborhood and node-detail responses; the active
   domain is fetched again under a new request generation.
2. The fixed OCI image `58f70df` does not provide this change's shard and
   first-activation source. Production therefore seals a dedicated full-src
   operator bundle (manifest, per-file digests, logical/archive/manifest
   digests and capture revision) into the transaction plan. The remote driver
   validates and extracts that bundle before stopping consumers, then runs it
   from an isolated `/operator-bundle` root with the fixed image's tsx and
   node_modules; it never mounts or falls back to the image's `/app/src`.
3. Immutable node-detail sources may retain `teachingFields`, but the API
   projects the response by authenticated role: STUDENT JSON omits the field
   entirely, while TEACHER and ADMIN retain their existing allowed boundary.

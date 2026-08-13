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

## Risks / Trade-offs

- [Many small requests add latency] → Permit version-valid summary prefetch and coalesce concurrent identical shard requests.
- [Mixed versions corrupt the graph] → Reject mismatched envelopes before merge and invalidate the affected cache family.
- [Cross-domain expansion grows without bound] → Return boundary references first and require explicit entry or node selection for the adjacent shard.

## Migration Plan

Add endpoints beside the current active canvas endpoint, prove payload and request budgets, migrate the new workspace, then retain full-canvas access only for authorized diagnostics. Rollback returns the UI to the current endpoint without changing selectors.

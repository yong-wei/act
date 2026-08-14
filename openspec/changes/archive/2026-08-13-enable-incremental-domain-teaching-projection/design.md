## Context

ACT Teaching Projection is independently versioned from Engineering Authority, but its current manifest is course/resource oriented and does not define append-only domain shards or partial coverage semantics for the active graph. The UI must consume new reviewed teaching relations without code changes and must remain useful when no teaching edge exists.

## Goals / Non-Goals

**Goals:**
- Define deterministic domain teaching fragments and a composed projection manifest.
- Keep partial, empty and unavailable teaching coverage non-blocking for engineering browsing.
- Load future published teaching relations through data-driven relation registration.
- Preserve direct-edge review, provenance and immutable versions.

**Non-Goals:**
- Derive prerequisites from engineering predicates, course order or graph layout.
- Require complete teaching coverage before publication.
- Modify existing published edges in place.

## Decisions

1. **Use append-only domain fragments.** Each fragment declares its domain keys, core-node references, direct ACT_TEACHING edges, evidence references and fragment digest. A composed manifest orders accepted fragments and produces one deterministic projection identity.
2. **Separate validity from coverage.** Invalid identities, dangling endpoints, cycles or false provenance block the affected candidate publication. Low counts, unreviewed objects and empty domains produce coverage status only and never invalidate Engineering Authority.
3. **Keep relation semantics registry-driven.** Composition resolves published teaching relation kinds through their registered presentation family. A future valid direct relation therefore enters the composed projection without a release-specific relation list; client and shard-service consumption remain with the subsequent runtime change.
4. **Preserve prior published fragments.** Adding a fragment creates a new projection version; it does not rewrite prior evidence or require re-review of unchanged engineering or teaching records.
5. **Seal offline input without claiming runtime ownership.** Builder, composition and activation validation carry a canonical Authority envelope, source-inventory digest and independently supplied expected identity. This closes artifact-integrity checks without reading a live pointer; runtime selection, route, cache and live-drift policy remain owned by #1375.

## Risks / Trade-offs

- [A partial projection looks complete] → Expose bounded human-readable coverage state and distinguish no-published-relation from service failure.
- [Fragments create global cycles only after composition] → Run endpoint and REQUIRED-edge DAG validation over the complete composed candidate before publication.
- [A future relation lacks presentation registration] → Omit it from product rendering with a bounded notice while retaining internal review diagnostics.

## Migration Plan

Add fragment schema and composition tooling, translate current published teaching records into the first fragment without changing their meaning, then validate an activation identity independently of Authority. Rollback selects the prior Teaching Projection; the runtime pointer, domain route, cache and Authority loader remain with the subsequent runtime change.

## Open Questions

None. Coverage targets are intentionally content-governance metrics, not activation gates.

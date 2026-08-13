## Context

The current active Authority contains thousands of heterogeneous objects. ActKG remains authoritative for engineering objects and relations, while ACT needs a human navigation projection that does not become another engineering truth source. Existing workspace contracts already permit a reviewed root catalog and progressive domain loading, but no Authority-specific catalog or multi-domain membership contract exists.

## Goals / Non-Goals

**Goals:**
- Define eight stable human-facing domains and one aggregate entry.
- Support reviewed many-to-many membership without mutating Authority facts.
- Give every catalog version deterministic identity, validation and localized presentation.
- Keep all opaque identities out of product-visible and accessibility surfaces.

**Non-Goals:**
- Reclassify ActKG object types or relations.
- Infer teaching order or generate semantic edges.
- Implement shard APIs or the final workspace UI.

## Decisions

1. **Store a separate reviewed display catalog.** The catalog contains stable domain keys, Chinese names, summaries, ordering, visual roles and member Authority object references. It is a presentation artifact, not an ActKG release. Using canonical engineering relations as the only root algorithm was rejected because graph centrality does not express the course's human conceptual map.
2. **Use many-to-many membership.** One object may appear in several domain shards while retaining one canonical object identity. A deterministic preferred navigation domain is stored only for deep-link resolution; it does not erase secondary memberships. Single ownership was rejected because control concepts legitimately span analysis and design domains.
3. **Treat integration as an aggregate.** The integration component summarizes the eight domains and may route into them, but it cannot be rendered as a peer domain or create synthetic Authority edges.
4. **Validate against one frozen Authority selection.** Every referenced object must exist in the selected Authority snapshot, every domain key must be registered, and every user-facing string must pass the system-string denylist. Unknown or missing memberships remain explicit review findings instead of runtime guesses.

## Risks / Trade-offs

- [Catalog membership becomes stale after an Authority update] → Bind the catalog to Authority identity and require a new reviewed catalog version for changed references.
- [Repeated objects confuse users] → Preserve one object identity and show cross-domain membership in navigation instead of duplicating content.
- [Navigation roots are mistaken for facts] → Mark their DTO kind as presentation-only and exclude them from Authority relation, evidence and count claims.

## Migration Plan

Publish the catalog beside the existing Authority runtime, validate it without changing selectors, then let later shard and UI changes consume it. Rollback removes the catalog consumer and leaves the existing active Authority canvas unchanged.

## Open Questions

None. Domain labels and the aggregate role are fixed by this series; individual object memberships remain reviewable implementation data.

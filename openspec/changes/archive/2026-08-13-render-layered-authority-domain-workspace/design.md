## Context

The active Authority canvas faithfully shows objects and relations but offers no human-scale hierarchy. The new domain catalog and shard service allow the client to separate overview, teaching order and engineering detail without changing graph truth.

## Goals / Non-Goals

**Goals:** implement a two-level domain workspace, default teaching skeleton, explicit engineering relation filters, secondary object disclosure and cross-domain navigation.

**Non-Goals:** draw every relation, infer teaching order, display opaque governance identity, or make teaching completeness a readiness gate.

## Decisions

1. **Use two navigation levels.** L0 renders eight domain roots plus the aggregate entry. L1 renders one domain at a time. Domain roots are presentation controls; L1 object nodes and edges retain their source layer identity.
2. **Default to published teaching order.** The initial L1 request renders PUBLISHED direct prerequisites/post-requisites. When none exist, primary domain objects remain selectable and the workspace states that teaching relations are not yet published.
3. **Map engineering predicates into four filters without rewriting them.** Structure covers `has_component`/`part_of`; derivation and representation covers `derived_from`, `has_formula`, `has_representation`; application and analysis covers `applies_to`, `used_to_analyze`; association covers exact associations. Inspector provenance retains the actual human term and direction.
4. **Treat Formula and KnowledgeStatement as secondary.** They load through filters, selection, search or one-hop expansion rather than populating the first domain view. DomainConcept and SystemModel form the default object layer.
5. **Use boundary portals for cross-domain edges.** The current domain shows a human-readable adjacent-domain cue. Entering it loads the target domain before selecting the object; no synthetic summary edge becomes an Authority fact.
6. **Preserve stable interaction state.** Shard arrival, filter changes and inspector activity merge into the established layout without full remount or force reheating.

## Risks / Trade-offs

- [Sparse teaching projection yields a thin default view] → Keep primary domain objects visible and make coverage status honest, while optional engineering filters remain available.
- [Relation filters obscure exact predicates] → Use family labels only as controls; show registered human predicate terms in edge detail and inspector.
- [Secondary objects are hard to find] → Keep search, directory and selected one-hop expansion capable of locating every presentable Authority object.

## Migration Plan

Implement behind the active Authority workspace contract, validate all roles and responsive states, then replace the current active entry view. Legacy remains an explicit separate source. Rollback restores the previous active renderer without changing data.

## Context

The report recommends that any resource become path-plannable once registered as a ResourceNode. The current platform already has renderable resources, knowledge nodes, media, simulations, and Arena tasks, but not a unified planning abstraction or audit contract.

## Decisions

### ResourceNode sits above rendering systems

`TeachingResource`, component registry, runtime media files, simulation launchers, and Arena tasks remain rendering or launch sources. ResourceNode stores planning metadata and stable `sourceKind`/`sourceRef` pointers.

### Source-of-record ownership stays explicit

Managed DB metadata belongs to `TeachingResource` once an asset is promoted there. Runtime lesson media indexes remain the authored source for video/audio/handout references until promoted or backfilled. ResourceNode does not copy raw content bodies.

### Audits gate path eligibility

Resources without a verified render/launch target, knowledge mapping, valid prerequisites, availability, or privacy policy are reported and excluded from adaptive paths unless explicitly allowed by policy. The builder does not fabricate UI routes for sources that only provide content identity.

## Risks / Trade-offs

- Backfilling every resource family can expose historical inconsistencies; audit output must be usable by teacher/admin management.
- Prematurely moving all content metadata into ResourceNode would create duplicate ownership, so ResourceNode remains a planning layer.

## Migration Plan

1. Add ResourceNode and edge schema/contracts.
2. Map supplied source records into ResourceNodes.
3. Add audits and path-eligibility flags.
4. Leave production aggregation APIs for downstream path planner and teacher management changes.

## Open Questions

- None.

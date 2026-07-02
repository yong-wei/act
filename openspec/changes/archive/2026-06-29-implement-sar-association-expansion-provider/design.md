## Design

The expansion provider accepts a query, use case, caller scope, seed refs, and a bounded SAR projection snapshot. It does not build the final answer context or verified citation pack. It returns associated events and entities with trace metadata that downstream consumers can pass into Source Pack or display as diagnostics.

## Flow

1. Normalize provided seed refs.
2. Resolve seed entities.
3. Select direct events for 0-hop.
4. Expand event-to-entity and entity-to-event for 1-hop.
5. Repeat once for 2-hop when requested.
6. Apply privacy and authority filtering.
7. Rank deterministically by seed match, hop distance, authority, freshness, and use-case fit.
8. Return trace and candidate refs for downstream Source Pack or consumer integration.

## Boundary Correction

This provider must not merge, rank, diversify, or hydrate full RAG chunks as the Source Pack builder does. It may return `retrievalChunkId`, `citationTargetId`, `resourceNodeId`, `planningUnitId`, and event ids as seed material for a Source Pack request.

## Trace

Trace must include seed entities, expanded entities by hop, selected events, rejected refs with reasons, privacy limitations, version refs, and output budgets.

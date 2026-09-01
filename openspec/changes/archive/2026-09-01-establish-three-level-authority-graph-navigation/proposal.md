## Why

The active Authority workspace exposes fifteen domain entries but seals default shards for only eight, and each available default shard materializes the complete heterogeneous domain rather than a bounded concept overview. This breaks the existing server-bounded exploration contract, makes seven root entries fail after selection, and removes the intended distinction between domains, domain concepts, and a selected concept's real neighborhood.

## What Changes

- Define one exact three-level navigation contract: line-free top-level domains, a bounded `DomainConcept`-only domain overview, and a selected concept's published one-hop semantic network.
- Require every visible root domain to have a version-matched default shard, search coverage, neighborhood closure, and detail closure; missing coverage fails qualification instead of producing a clickable dead entry.
- Replace the byte-only two-megabyte domain budget with explicit object-count, type, response-size, completeness, and latency budgets derived from the active catalog denominator.
- Rebuild all fifteen v0.37 domain defaults so secondary types remain discoverable only through bounded search or one-hop disclosure and never through a client-truncated full-domain response.
- Add negative gates that reject complete-domain payloads, hidden client-side full graphs, ghost root entries, synthetic grouping edges, and name-based hierarchy inference.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `authority-domain-shard-delivery`: Require complete fifteen-domain shard coverage and a bounded `DomainConcept` overview contract.
- `active-authority-semantic-graph-presentation`: Make the three visible levels and server-owned progressive materialization normative on desktop and mobile.
- `layered-authority-domain-workspace`: Align domain entry, concept overview, search, and selected one-hop behavior with one shared hierarchy.

## Impact

- Affects Authority domain shard materialization, runtime loaders, active graph workspace state, root/domain APIs, search and neighborhood APIs, and their validation tests.
- Rebuilds checked-in/runtime v0.37 shard artifacts without changing ActKG Schema, Authority object or relation truth, Teaching Projection, or production selectors.
- Establishes the prerequisite data contract for force-layout, formula, bilingual, control-panel, and final acceptance changes in this series.

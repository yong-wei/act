# Restore Legacy Domain Graph Presentation

## Why

The active Authority workspace (`src/features/knowledge/active-authority-graph.tsx`) currently opens on a flat card grid of domain entries, while the well-received Legacy circular root presentation survives only behind the `legacy` mode of the knowledge workspace switcher. Learners lose the spatial, at-a-glance domain map that the Legacy graph provided, and the current root grid gives no path toward the settled product direction: circular domain entries feeding progressive per-domain relation graphs with a Legacy-style node detail sidebar, all reading from the currently active composite release instead of the v0.9 catalog. Series issue #1441.

## What Changes

- Replace the `/knowledge` active root card grid with circular domain entries plus one comprehensive aggregate entry, ported from the Legacy root bubble presentation (`src/features/knowledge/graph/root-layout.ts`), not rebuilt from scratch.
- Derive the number of domain entries from the ACTIVE composite release's domain catalog at read time; entry count is never hard-coded.
- Draw no connecting lines of any kind between root entries: the root view is pure spatial arrangement of navigation projections. Edges anywhere in the workspace may only represent real published Authority or teaching relations; rendering future published inter-domain relations at the root would require a new proposal.
- Activating a domain progressively loads only that domain's root shard and default published teaching relations; selecting a node loads its adjacent relations and detail content on demand. The global graph is never fetched by ordinary navigation.
- The per-domain graph shows published teaching semantics by default with explicit engineering relation-family filters; missing teaching projection coverage does not block display of Authority objects.
- Restore the Legacy-style node detail sidebar experience — human-facing name, type, description, relation summary, governed knowledge cards and infographs — with interaction parity with the Legacy graph, resolved from the active composite release and its ACT display projections.
- Keep normal UI free of internal identifiers (object/relation IDs, Release/ReleaseSet/Snapshot/Activation/Projection, version hashes, internal enums or paths), failing closed on missing human-facing labels.
- v0.9 remains only behind its separate read-only history entry and does not serve normal graph reads.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `layered-authority-domain-workspace`: Root level becomes catalog-driven circular domain entries (plus the aggregate entry) with no inter-entry lines; domain activation loads only that domain's root shard and default teaching relations.
- `active-authority-semantic-graph-presentation`: The node-link canvas contract is scoped to the domain and knowledge levels; the root level presents edge-free circular domain navigation.
- `authority-card-infograph-inspector`: The stable inspector gains Legacy interaction parity and binds its content to the currently active composite release's ACT display projections.

## Impact

- Affects the `/knowledge` active workspace root screen, the ported root bubble layout, domain shard loading, relation-family filtering defaults, and the node detail inspector in `src/features/knowledge/`.
- Can proceed in parallel with the v0.22 candidate changes: the UI binds to whatever composite release is active, so v0.22 content appears in production only after the composite cutover activation, without further UI work.
- Does not modify ActKG Authority data, release import or activation pipelines, teaching projection generation, or the v0.9 read-only history entry.

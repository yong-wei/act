## ADDED Requirements

### Requirement: Knowledge graph first render is collapsed and root-first
The knowledge graph SHALL render a useful collapsed root graph before requesting or parsing the full graph.

#### Scenario: Learner opens the knowledge graph
- **WHEN** a learner opens `/knowledge`
- **THEN** the first visible graph payload SHALL contain only top-level graph roots and root summaries
- **AND** the first visible graph SHALL NOT require the full graph endpoint, all knowledge nodes, or all relations to complete before nodes are visible.

#### Scenario: Runtime chapter metadata is available
- **WHEN** runtime knowledge nodes include chapter metadata
- **THEN** the first-screen root graph SHALL use stable chapter-level roots unless a reviewed graph-root catalog explicitly declares a better top-level hierarchy
- **AND** concept roots inferred from `contains` edges SHALL NOT replace stable chapter roots without a deterministic review contract.

### Requirement: Knowledge graph nodes expand and collapse on demand
The knowledge graph SHALL reveal child nodes and relations through explicit node expansion instead of showing all filtered nodes by default.

#### Scenario: User selects a collapsed node
- **WHEN** a user selects a collapsed graph node
- **THEN** the node detail or local affordance SHALL expose an expand action
- **AND** activating the expand action SHALL reveal the node's children and visible relations under the active filter.
- **AND** the expand action SHALL be keyboard reachable and activatable with Enter and Space.
- **AND** the expand action SHALL expose accessible expanded or pending state through `aria-expanded`, `aria-busy`, status text, or an equivalent accessibility contract.

#### Scenario: User selects an expanded node
- **WHEN** a user selects an expanded graph node
- **THEN** the node detail or local affordance SHALL expose a collapse action
- **AND** activating the collapse action SHALL hide that expansion's descendants without evicting already loaded graph data from the client cache.
- **AND** the collapse action SHALL preserve selected-node context and focus continuity.

#### Scenario: Expansion data is not cached
- **WHEN** a user expands a node whose required shard is not yet loaded
- **THEN** the graph SHALL show a local loading state for that node or expansion path
- **AND** the rest of the graph, local tools, inspector, and floating dock SHALL remain interactive.
- **AND** background shard loading SHALL NOT move focus away from the initiating control, inspector, local tool, or Konling surface.

#### Scenario: Expansion has no visible children
- **WHEN** a user expands a node and the active filter hides all children or relations in that expansion
- **THEN** the graph SHALL show a local empty or filtered-out explanation
- **AND** the UI SHALL distinguish filtered-empty from network failure.

### Requirement: Knowledge graph loads matching and remaining graph data progressively
The knowledge graph SHALL load graph data in ordered batches instead of treating the full graph as the first required payload.

#### Scenario: First-screen roots are visible
- **WHEN** the root graph has rendered
- **THEN** the client SHALL begin loading shards for the active filter signature in the background
- **AND** those shards SHALL fill the graph cache without forcing every matching node to become visible before the user expands nodes.

#### Scenario: Active-filter shards are cached
- **WHEN** active-filter graph shards are complete
- **THEN** the client MAY begin loading remaining or dense graph shards in the background
- **AND** dense or weak relation families SHALL remain hidden until the user requests a denser relation mode, search result, or expansion that requires them.

#### Scenario: User changes graph filters
- **WHEN** a user changes chapter, relation-family, density, strength, search, or connected-node filters
- **THEN** the graph SHALL request only missing shards required by the new filter signature
- **AND** already loaded nodes, links, and shards SHALL be reused without duplicate network requests or duplicate graph objects.

### Requirement: Knowledge graph shard cache is explicit and versioned
The knowledge graph SHALL identify graph payloads by graph version and shard keys so progressive loading is deterministic and cacheable.

#### Scenario: Graph shard is requested
- **WHEN** the client requests a graph root, expansion, active-filter, or remaining-graph shard
- **THEN** the request or response SHALL include a graph version and shard identity
- **AND** the client SHALL record loaded shard keys, loading shard keys, loaded node ids, and loaded link keys.

#### Scenario: Shard data is merged
- **WHEN** a graph shard arrives
- **THEN** nodes SHALL be merged by node id and links SHALL be merged by stable link key
- **AND** merging a shard SHALL NOT remount existing graph nodes, reset selected-node context, or discard user-positioned layout state.

#### Scenario: Runtime graph version changes
- **WHEN** the graph version changes
- **THEN** stale loaded shard records SHALL be invalidated or ignored
- **AND** the next root request SHALL establish the new graph version before expansion shards are trusted.

### Requirement: Knowledge graph keeps full graph loading out of normal user flows
The knowledge graph SHALL preserve full graph access only as a diagnostics or maintenance path outside normal `/knowledge` user interaction.

#### Scenario: First render is measured
- **WHEN** tests or browser evidence inspect `/knowledge` first render
- **THEN** the page SHALL not request, parse, or depend on the full graph endpoint before top-level root nodes are visible
- **AND** a spinner-only state SHALL NOT be accepted as the first rendered knowledge graph state.

#### Scenario: User explicitly requests dense exploration
- **WHEN** a user selects all-relations, dense mode, or another full-graph exploration action
- **THEN** the graph SHALL request missing remaining graph shards rather than the full graph compatibility endpoint
- **AND** the UI SHALL identify the denser mode as explicit and reversible.
- **AND** any full graph endpoint retained for diagnostics SHALL NOT be used by the normal `/knowledge` user interaction path.

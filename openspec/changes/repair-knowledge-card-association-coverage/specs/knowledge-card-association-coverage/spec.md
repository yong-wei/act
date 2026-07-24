## ADDED Requirements

### Requirement: Every graph node has an explained knowledge-card disposition

The runtime export SHALL classify every canonical knowledge-graph node as linked, missing authoring, invalid mapping or runtime, or explicitly excluded. An exclusion SHALL reference a known node and contain a non-empty reason.

#### Scenario: Coverage is complete

- **WHEN** the global knowledge graph is exported
- **THEN** every runtime node SHALL appear exactly once in the coverage report
- **AND** no node SHALL remain missing or invalid
- **AND** an excluded node SHALL have a recorded reason and no card projection.

### Requirement: Authoring and runtime card identities remain consistent

For every linked node, the authoring card frontmatter `node_id`, canonical graph node ID, runtime card filename, and graph resource path SHALL identify the same canonical node. Runtime card content SHALL be a byte-identical projection of the selected authoring card.

#### Scenario: A mapping or projection drifts

- **WHEN** a selected card has a different frontmatter node ID, the runtime card is absent, or runtime content differs from authoring
- **THEN** the node SHALL be classified as invalid
- **AND** formal export SHALL fail before publishing an incomplete graph.

### Requirement: Missing base-graph cards can be materialized without data loss

The materialization command SHALL create standard authoring cards only for uncovered base-graph nodes with names and definitions. It SHALL preserve existing canonical and selected-card files and SHALL NOT materialize explicitly excluded nodes.

#### Scenario: Existing and missing cards are processed together

- **WHEN** materialization runs over a graph containing reviewed cards and uncovered nodes
- **THEN** reviewed card bytes SHALL remain unchanged
- **AND** uncovered nodes SHALL receive cards containing canonical node IDs, definitions, formulas, examples, and keywords available from authoring truth.

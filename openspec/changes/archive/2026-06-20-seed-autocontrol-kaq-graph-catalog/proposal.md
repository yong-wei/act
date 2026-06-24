## Why

The graph-center foundation needs a realistic automatic-control catalog, not only abstract schema examples. Current runtime knowledge graph data already contains hundreds of course nodes, and recent resource work maps many resources to knowledge and capability refs. The first seed catalog should reuse those ids where possible instead of inventing a parallel knowledge graph.

## What Changes

- Seed an automatic-control K/A/Q catalog that covers core knowledge, capability, and quality objectives.
- Bind seed knowledge graph nodes to existing runtime knowledge node ids where available.
- Add capability nodes that reference knowledge nodes and observable evidence types.
- Add quality nodes with engineering scenarios, behaviors, rubric levels, and evidence sources.

## Capabilities

### New Capabilities
- `autocontrol-kaq-graph-catalog`: initial automatic-control objective and graph seed catalog.

### Modified Capabilities
- None.

## Dependencies

- Depends on `define-kaq-objectives-and-portrait-v2`.
- Depends on `introduce-kaq-graph-schema`.

## Impact

- Provides testable and reviewable seed data for graph-center implementation.
- Does not require all course knowledge nodes to be manually curated in one pass.
- Does not change path-planning algorithms.

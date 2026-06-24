## Why

The existing `/knowledge` graph is a strong knowledge map, but it cannot by itself express capability expectations or quality objectives. The graph-center migration needs a shared schema that separates graph body data from learner overlays and resource coverage.

Without this schema, capability and quality views would either overload current knowledge-node fields or become disconnected page-local data.

## What Changes

- Define common graph domain, node, edge, relation, and validation types for knowledge, capability, and quality graphs.
- Keep graph body data separate from learner, class, and resource overlays.
- Require capability nodes to bind to knowledge nodes and observable evidence.
- Require quality nodes to declare scenario, observable behavior, rubric levels, and evidence sources.

## Capabilities

### New Capabilities
- `kaq-graph-schema`: shared graph schema and validation contract for K/A/Q graph domains.

### Modified Capabilities
- None.

## Dependencies

- Depends on `define-kaq-objectives-and-portrait-v2`.

## Impact

- Establishes data contracts for future graph-center payloads.
- Does not replace the current runtime knowledge graph loader in this change.
- Does not introduce graph database infrastructure.

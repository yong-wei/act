## Why

The graph center should not only show curriculum structure. It must reveal whether graph nodes are supported by registered resources, path-eligible resources, RAG-indexed materials, assessments, simulations, and Arena tasks. Current ResourceNode and RAG projection contracts already contain much of this data, but there is no graph-node coverage overlay.

This change is separate from learner overlays because it can be computed from resource metadata without reading private learner evidence.

## What Changes

- Add a graph resource coverage overlay payload keyed by graph domain and node id.
- Count linked resources, path-eligible ResourceNodes, RAG-indexed chunks, assessment resources, and simulation/Arena resources.
- Surface sufficient, partial, missing, and not-audited states with explicit missing coverage types.
- Keep coverage overlay read-only and source-of-record neutral.

## Capabilities

### New Capabilities
- `graph-resource-coverage-overlay`: graph-node resource coverage status and display contract.

### Modified Capabilities
- None. It consumes ResourceNode and RAG projection data without changing their source-of-record rules.

## Dependencies

- Depends on `build-graph-center-readonly-foundation`.
- Uses existing `resource-node-registry` and `learning-evidence-rag-corpus` contracts.

## Impact

- Helps teachers and administrators find resource gaps.
- Does not make unavailable resources path-eligible.
- Does not expose private learner evidence.

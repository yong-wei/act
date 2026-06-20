## Why

The platform now has ResourceNode planning, learner state, RAG citations, Konling context, and a large runtime knowledge graph, but the teaching objective layer is still implicit. Current learner state keeps six broad competency dimensions, while the graph-center plan requires knowledge, capability, and quality objectives to act as shared anchors for graph nodes, resources, paths, citations, diagnosis, and teacher reports.

Without a first-class K/A/Q objective taxonomy and a compatible portrait v2, later graph-center work would create UI filters that path planning and Konling cannot reliably consume.

## What Changes

- Define knowledge, capability, and quality objective domains with overall, secondary, and tertiary levels.
- Introduce `competency-portrait.v2` as a seven-dimension aggregation model while preserving the current six primary competency dimensions.
- Define compatibility mappings from the six existing dimensions and registered goal slices into the seven portrait dimensions.
- Require every objective to declare evidence policy, graph binding policy, status, and portrait dimension mapping.

## Capabilities

### New Capabilities
- `kaq-objective-taxonomy`: canonical K/A/Q objective definitions and portrait v2 compatibility.

### Modified Capabilities
- None. Existing learner-state and path-planning specs remain compatible until later implementation changes consume the new taxonomy.

## Dependencies

- First change in the graph-center migration series.
- Later changes must consume the objective ids rather than re-declaring local goal labels.

## Impact

- Affects future objective catalog files, learner-state aggregation, path target registration, and graph-center filters.
- Does not remove or rename the current six competency dimensions.
- Does not migrate stored learner snapshots in this change.

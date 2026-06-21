## Why

Graph-driven planning will persist LearningGoal, resource, overlay, and path artifacts. Without explicit version references, old paths, Konling grounding, and learner overlays cannot be explained after graph or resource metadata changes.

## What Changes

- Add versioning requirements for LearningGoal packages, graph catalogs, resource registries, resource projections, overlays, path artifacts, and Konling grounding context.
- Require persisted path and overlay artifacts to record the versions they used.
- Require version limitations when an artifact references stale, missing, or migrated graph/resource data.
- Keep this as an early prerequisite for graph-driven planning rather than a late reporting enhancement.

## Capabilities

### New Capabilities

- `kaq-artifact-versioning`: version and replay references for K/A/Q graph, resource, overlay, path, and grounding artifacts.

### Modified Capabilities

- `adaptive-learning-path-planning`: persisted path rounds must include goal, graph, resource, and overlay version refs.
- `learning-evidence-rag-corpus`: citation and retrieval projections must expose source version or freshness limitations where available.

## Impact

- Affects future path persistence, overlay materialization, citation context, and graph-center diagnostics.
- Does not add graph migration UI or historical diff UI.
- Does not rewrite existing legacy artifacts unless a later migration change requests it.

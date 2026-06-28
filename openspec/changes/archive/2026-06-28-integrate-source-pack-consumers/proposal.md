## Why

The unified Source Pack core only matters if the main consumers stop using separate retrieval paths. Lesson and homework skills need source packs for large textbooks and references without loading the entire corpus into agent context. Konling needs query-aware, citation-verified evidence. Path planning needs goal-aligned resource evidence while still relying on ResourceNode/PlanningUnit governance for actual path nodes.

## What Changes

- Integrate Source Pack generation into lesson and homework authoring workflows as the recommended large-resource reference path.
- Replace or augment Konling's current coarse content citation selection with query-aware Source Pack retrieval and verified citation payloads.
- Provide path-planning Source Pack evidence for LearningGoal/knowledge/capability queries without promoting citation-only chunks into path nodes.
- Store or reference authoring source packs where useful for review and reproducibility.
- Add consumer-level tests for citation presence, profile filtering, and graceful limitation handling.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `source-pack-retrieval`: Add required consumer integration behavior for authoring tools, Konling, and path planning.
- `konling-agent-runtime`: Use Source Pack evidence for query-aware content citations while preserving learner-state personalization boundaries.
- `adaptive-learning-path-planning`: Consume Source Pack evidence as planning support, not as a replacement for ResourceNode/PlanningUnit eligibility.

## Impact

- Proposed integrations: lesson/homework skill docs or local scripts, Konling runtime retrieval path, path-planning evidence adapter.
- Proposed tests: lesson/homework source-pack CLI smoke, Konling cited answer context, path planner evidence support, consumer limitation handling.
- Operational impact: authoring workflows can produce compact source packs instead of loading large textbooks/reference books into model context.

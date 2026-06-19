## Why

Adaptive paths currently depend on governed ResourceNodes, but path options can still feel like coarse resource lists. The planner needs a PlanningUnit projection that expresses executable learning actions while preserving ResourceNode audit and active path execution contracts.

## What Changes

- Add PlanningUnit semantics as a refinement of audited ResourceNodes.
- Require path generation to choose resources by knowledge targets, capability targets, prerequisites, estimated time, cognitive load, learner state, and evidence capability.
- Preserve active path launch, return, resume, selection, and completion semantics managed by current changes.
- Prevent RAG chunks from becoming path nodes.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `adaptive-learning-path-planning`: add PlanningUnit projection semantics and path node granularity requirements.

## Impact

- Affects path planner inputs, path explanation payloads, resource graph readiness, and future path comparison UI.
- Depends on active path launch/return/resume/selection/completion changes for execution semantics.

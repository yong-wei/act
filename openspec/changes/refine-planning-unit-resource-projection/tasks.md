## 1. PlanningUnit Projection

- [ ] 1.1 Define PlanningUnit fields for resource/segment ref, knowledge targets, capability targets, prerequisites, effort, cognitive load, modality, evidence behavior, and launch binding.
- [ ] 1.2 Map PlanningUnits to audited ResourceNodes or generated checkpoint contracts.
- [ ] 1.3 Reject arbitrary RetrievalChunks as path nodes.

## 2. Planner Integration

- [ ] 2.1 Update path generation to include knowledge/capability target rationale per node.
- [ ] 2.2 Preserve active path launch, return, resume, selection, and completion contracts.
- [ ] 2.3 Add tests for path options with executable learning actions and visible evidence behavior.

## 3. Verification

- [ ] 3.1 Run targeted adaptive path planner tests.
- [ ] 3.2 Run `openspec validate refine-planning-unit-resource-projection --strict`.

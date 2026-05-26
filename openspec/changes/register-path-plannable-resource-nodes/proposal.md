## Why

Current resource registration is renderer-oriented. XH-202620 needs a ResourceNode abstraction that maps all eligible resources into a graph usable by learner state, path planning, visualization, and teacher governance without confusing content ownership.

## What Changes

- Add ResourceNode registry for lesson steps, knowledge nodes/cards, video, audio, handouts, quizzes, simulations, Arena tasks, reflections, AI interventions, and projects.
- Add ResourceNode graph metadata: prerequisites, estimated time, cognitive load, knowledge coverage, ability impact, availability, teacher policy, privacy level, and terminal constraints.
- Define source-of-record rules for `TeachingResource`, runtime lesson media, and ResourceNode planning metadata.
- Add registry audits for render/launch binding, knowledge mapping, prerequisites, availability, privacy, and path eligibility.

## Capabilities

### New Capabilities
- `resource-node-registry`: Defines path-plannable resource nodes, graph metadata, source references, and registry audits.

### Modified Capabilities
- None.

## Governance Contract Dependency

This change consumes `establish-adaptive-learning-governance-contracts` for prerequisite gates, ResourceNode privacy levels, path-eligibility audit visibility, evaluation-event references, rollback-safe registry flags, and data-dictionary handoff requirements.

## Impact

- Affects `src/lib/resource-registry.tsx`, TeachingResource/resource metadata, knowledge graph mappings, runtime lesson media indexes, and later path planning.
- Depends on `establish-adaptive-learning-governance-contracts`, `register-simulations-as-course-resources`, `unify-arena-preview-adapter-and-model-registry`, and `split-simulation-scene-shells`.

## 1. ResourceNode Registry

- [x] 1.1 Add ResourceNode and ResourceNode edge models/contracts.
- [x] 1.2 Define supported node types and `sourceKind`/`sourceRef` references.
- [x] 1.3 Map supplied source records for TeachingResources, registered interactive components, knowledge nodes/cards, runtime lesson media, handouts, quizzes, eligible simulations, Arena tasks, reflections, AI interventions, and projects.

## 2. Metadata and Audits

- [x] 2.1 Add planning metadata for prerequisites, estimated time, cognitive load, knowledge coverage, ability impact, cost, availability, teacher policy, privacy level, and terminal constraints.
- [x] 2.2 Add audits for missing render/launch binding, knowledge mapping, prerequisites, availability, privacy, and evidence instrumentation.
- [x] 2.3 Implement source-of-record behavior for TeachingResource, runtime media, and ResourceNode planning metadata.

## 3. Validation

- [x] 3.1 Add tests for deterministic mapping, source references, audit states, and path eligibility.
- [x] 3.2 Validate with `rtk openspec validate resource-node-registry --strict`.

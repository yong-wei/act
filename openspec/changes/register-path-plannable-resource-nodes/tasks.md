## 1. ResourceNode Registry

- [ ] 1.1 Add ResourceNode and ResourceNode edge models/contracts.
- [ ] 1.2 Define supported node types and `sourceKind`/`sourceRef` references.
- [ ] 1.3 Backfill ResourceNodes for TeachingResources, registered interactive components, knowledge nodes/cards, runtime lesson media, handouts, quizzes, eligible simulations, Arena tasks, reflections, AI interventions, and projects.

## 2. Metadata and Audits

- [ ] 2.1 Add planning metadata for prerequisites, estimated time, cognitive load, knowledge coverage, ability impact, cost, availability, teacher policy, privacy level, and terminal constraints.
- [ ] 2.2 Add audits for missing render/launch binding, knowledge mapping, prerequisites, availability, privacy, and evidence instrumentation.
- [ ] 2.3 Implement source-of-record behavior for TeachingResource, runtime media, and ResourceNode planning metadata.

## 3. Validation

- [ ] 3.1 Add tests for backfill idempotency, source references, audit states, and path eligibility.
- [ ] 3.2 Validate with `rtk proxy openspec validate register-path-plannable-resource-nodes --strict`.

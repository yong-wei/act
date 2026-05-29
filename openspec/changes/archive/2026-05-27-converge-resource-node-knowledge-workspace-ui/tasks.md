## 1. Workspace Contract

- [x] 1.1 Define graph, list, detail, related-resource, mapping-warning, and launch-action layout regions.
- [x] 1.2 Define ResourceNode detail fields for source kind/ref, knowledge coverage, prerequisites, availability, privacy, policy, evidence instrumentation, and path eligibility.
- [x] 1.3 Define student, teacher, admin, and audit detail variants.

## 2. Migration Scope

- [x] 2.1 Specify how current knowledge graph and resource panel components migrate to platform shell and status primitives.
- [x] 2.2 Preserve current graph exploration while ResourceNode-aware panels are feature-flagged.
- [x] 2.3 Define launch links to lessons, media, simulations, Arena tasks, and adaptive path nodes where available.
- [x] 2.4 Define launch ownership rules that use ResourceNode source references, `registryId`, or feature-owned launchers instead of importing resource implementations into the workspace UI.

## 3. Validation

- [x] 3.1 Add tests for ResourceNode panel state, partial coverage, warning display, and role-scoped details.
- [x] 3.2 Validate with `rtk proxy openspec validate converge-resource-node-knowledge-workspace-ui --strict`.

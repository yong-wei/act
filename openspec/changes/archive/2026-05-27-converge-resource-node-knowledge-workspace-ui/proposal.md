## Why

The UI report treats knowledge graph as a core product module, while the new adaptive series turns ResourceNode into the planning abstraction above lessons, media, quizzes, simulations, Arena tasks, AI interventions, and projects. The knowledge graph UI should evolve into a ResourceNode-aware workspace rather than remaining a separate visualization island.

## What Changes

- Define a unified knowledge/resource workspace for graph, list, detail, mapping, resource launch, and path eligibility views.
- Expose ResourceNode metadata, source references, knowledge coverage, prerequisites, availability, privacy level, teacher policy, evidence instrumentation, and audit warnings where backing data exists.
- Preserve current knowledge graph exploration while adding ResourceNode-aware panels behind feature flags.

## Capabilities

### New Capabilities
- `resource-node-knowledge-workspace-ui`: Defines the UI contract for ResourceNode-aware knowledge and resource exploration.

## Impact

- Affects knowledge graph UI, resource panels, lesson/media/resource launch links, and downstream adaptive path surfaces.
- Depends on `unify-platform-design-system-and-shell`, `standardize-platform-status-and-evidence-ui`, and `register-path-plannable-resource-nodes`.

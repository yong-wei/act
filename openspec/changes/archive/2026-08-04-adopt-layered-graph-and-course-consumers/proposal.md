## Why

The knowledge graph UI and course runtime currently conflate upstream engineering relations, teaching prerequisites, and resource availability. With versioned Authority and Teaching Projection available, consumers need explicit layers and course-scope reads while retaining compatibility fallback.

## Series Dependencies

- Depends on: `activate-versioned-actkg-engineering-authority`, `introduce-versioned-act-teaching-projection`, `project-active-course-resources-to-canonical`.

## What Changes

- Present three logical layers: ActKG engineering graph, ACT teaching prerequisite graph, and ACT teaching resource bindings.
- Make graph browsing default to Engineering Authority, with explicit teaching/resource overlays and identities.
- Make course pages and classroom knowledge drawers read only the current lesson scope's Projection.
- Resolve drawer content from step Canonical refs to optional cards; missing cards do not imply missing nodes.
- Preserve Legacy/pinned fallback when a consumer's new combination is unavailable and expose its status.

## Capabilities

### New Capabilities

None. Existing graph projection and workspace contracts are extended.

### Modified Capabilities

- `knowledge-graph-projection-contract`: graph payloads expose independent Authority, teaching, and resource layers and version combinations.
- `resource-node-knowledge-workspace-ui`: UI renders scoped resources, prerequisites, optional cards, and explicit fallback status.

## Impact

- Knowledge graph API/payload, graph workspace filters/inspector, course runtime resource resolver, and classroom knowledge drawer.
- No upstream ActKG mutation, path/learning-fact algorithm change, database schema, or deployment.

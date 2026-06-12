## Why

Student-facing learner surfaces, profile/growth/evidence pages, adaptive practice, knowledge graph, and data center currently expose related concepts with different local hierarchy. The future learning path loop will add path options, evidence basis, selection history, and cited explanations, which makes this inconsistency more expensive.

## What Changes

- Migrate learner record, profile, dashboard, adaptive practice, knowledge graph, evidence browser, and data center representative routes to the unified shell archetypes.
- Use `learning-atlas` for learning/path discovery and `knowledge-data-map` for learner evidence, knowledge graph, and data center surfaces.
- Prepare shell slots for three-style path options, evidence confidence, missing sources, and Konling cited explanation.
- Remove emoji/local palette/page-local header debt from migrated student cockpit and learner surfaces.

## Capabilities

### Modified Capabilities

- `commercial-student-entry-surfaces`
- `platform-data-center-ui`

## Impact

- Depends on `upgrade-platform-app-shell-to-archetype-shell`.
- Soft-aligns with `three-style-learning-path-loop`.
- Does not migrate mission workspaces or teacher/admin operations.

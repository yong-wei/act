## Why

The knowledge graph needs the same persistent right-bottom Konling assistant model as the rest of the commercial platform. When a learner selects a graph node, Konling should know the current knowledge context without creating a second assistant panel or trusting client hints for permissions.

## What Changes

- Register `/knowledge` with the shared platform floating dock for Konling.
- Keep the Konling entry persistent at the right bottom, aligned with the shared dock visual style and collision rules.
- Provide knowledge workspace context to Konling, including current route, selected node, visible filters, density mode, view mode, relation context, and available learning actions.
- Keep server-owned scope and permissions authoritative; client graph hints may narrow context but must not expand access.
- Add degraded or unavailable assistant states when selected-node or learner context is incomplete.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `platform-design-system-and-shell`: extend shared floating dock expectations to the knowledge graph workspace.
- `konling-agent-runtime`: define knowledge workspace context for the assistant.
- `resource-node-knowledge-workspace-ui`: connect selected-node state and graph context to the shared assistant without duplicating UI.

## Impact

- Affects AppShell dock registration, knowledge graph page context metadata, Konling runtime context resolution, and UI governance evidence.
- Coordinates with `unify-konling-simulation-dock` but does not modify simulation-specific assistant behavior.
- Does not add new state-changing Konling tools.

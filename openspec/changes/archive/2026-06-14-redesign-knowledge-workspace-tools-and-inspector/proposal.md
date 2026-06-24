## Why

The knowledge graph page has already entered the unified platform shell, but local graph controls and the selected-node drawer still feel crowded and page-local. The next redesign should make `/knowledge` a canvas-first commercial workspace that aligns with the platform shell while keeping graph tools compact and useful.

## What Changes

- Redesign chapter directory, relation filters, relation legend, view controls, layout controls, and focus controls as compact local workspace tools.
- Redesign the selected-node panel as a stable inspector rail on desktop and a sheet/drawer on mobile.
- Use the approved Product Design concepts as references: layered graph organization, premium dark mode, and clear light mode.
- Keep global navigation, theme switch, user center, and Konling dock in the shared AppShell rather than duplicating them inside the graph.
- Add acceptance criteria for tool open/closed states, inspector hierarchy, responsive layout, and design-reference adoption.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `resource-node-knowledge-workspace-ui`: define the redesigned local tool and selected-node inspector behavior.
- `commercial-workspace-surface-system`: clarify how knowledge graph local tools fit the shared dense-workspace surface model.

## Impact

- Affects knowledge graph layout composition, local tool components, selected-node resource panel, responsive behavior, and visual evidence.
- Builds on existing archived specs for relation visual grammar, graph readability, localized labels, and compact default tools.
- Does not change the knowledge data schema or platform role navigation.

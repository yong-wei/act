## Context

The user requires the right-bottom Konling assistant to be unified, persistent, and context-aware. The current product direction already rejects page-local duplicate assistant regions. Active `unify-konling-simulation-dock` handles simulation pages; this change applies the same shared-dock principle to `/knowledge`.

The selected node is central to knowledge graph use. Konling should receive enough context to answer about the current graph state, but permission and privacy scope must remain server-owned.

## Goals / Non-Goals

**Goals:**

- Use one shared Konling dock entry on `/knowledge`.
- Keep the assistant visually consistent with the platform dock in light and dark themes.
- Pass current selected node and graph state to Konling as scoped context.
- Prevent client-provided hints from expanding data access or tool permissions.

**Non-Goals:**

- Implement new Konling tools or autonomous graph editing.
- Replace the node inspector with chat.
- Change simulation dock behavior owned by `unify-konling-simulation-dock`.

## Decisions

### 1. One assistant entry per page

`/knowledge` should render Konling through the shared floating dock. The page may show local learning actions, but it must not render a second right-bottom assistant or an independent assistant drawer.

Alternative considered: keep a page-local assistant panel. That fragments the assistant experience and creates collision with inspector/tools.

### 2. Selected node becomes assistant context

Konling should know the current selected node id, display name, node type, chapter, relation summaries, active filters, density mode, view mode, and available learning actions. It should update when selection changes.

Alternative considered: pass only route name. That loses the most useful graph context.

### 3. Server-owned scope remains authoritative

Client graph hints can identify the visible surface and selected node, but server-side context resolution determines learner identity, privacy scope, accessible resources, evidence availability, and tool permissions.

Alternative considered: let the graph component pass full permission state. That risks widening access from client UI state.

## Risks / Trade-offs

- Updating assistant context on every pointer movement would be noisy. Mitigation: use selected node and explicit focus/filter state, not hover preview, as durable context.
- Dock expansion can overlap inspector or local tools. Mitigation: reuse shared dock collision metadata and add knowledge-specific evidence.
- Missing selected-node context can make suggestions generic. Mitigation: expose an explicit degraded state and route-level suggestions.

## Migration Plan

1. Inventory existing Konling launchers and assistant-like regions on `/knowledge`.
2. Register `/knowledge` with the shared dock model and remove duplicate page-local assistant entry if present.
3. Add knowledge workspace context assembly for selected node, graph filters, density, view, and learning actions.
4. Resolve permissions and learner scope through server-owned context.
5. Capture dock collapsed/expanded, selected-node context, no-selection fallback, light/dark, and mobile evidence.

## Dependencies

- Coordinates with `persist-app-shell-navigation-preference` for global shell behavior.
- Depends on `stabilize-knowledge-graph-interaction-state` so selected-node context updates do not rebuild graph layout or use hover as durable assistant context.
- Coordinates with `redesign-knowledge-workspace-tools-and-inspector` to avoid dock collisions with the inspector and local tools.
- Reuses the shared dock pattern also being specialized for simulations by `unify-konling-simulation-dock`.

## Why

The current `/knowledge` graph workspace mixes three panel models: inline local tool panels, a separately positioned filter panel, and a right-side stable inspector rail. This makes panel gaps vary with canvas size, lets detail open shrink and shift the graph, and creates scroll and floating-tool conflicts in the main graph workspace.

## What Changes

- Standardize directory, filter, legend, and view controls under one local tool panel shell with consistent placement, width, close behavior, scroll behavior, and focus handling.
- Anchor local graph tool panels near the AppShell content edge with a fixed workspace inset, so the gap does not grow when the graph canvas is wider.
- Remove page-level scrolling from the graph canvas workspace; graph pan and zoom remain internal to the canvas and must not conflict with browser/page zoom or route scrolling.
- Convert the selected-node detail panel from a desktop stable rail into a floating inspector that is tight to the right workspace edge and does not resize, re-center, or relayout the graph.
- Keep right-bottom shared tools, including Konling and the workspace tools launcher, floating independently; opening local graph tools or the inspector must not move the Konling floating button.
- Require visual verification evidence and independent visual audit approval before implementation can be accepted.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `commercial-workspace-surface-system`: Tightens the `/knowledge` workspace contract so local panels and the selected-node inspector are edge-anchored overlays rather than layout participants.
- `commercial-ui-governance-gates`: Adds verification gates for graph workspace panel geometry, non-overlap, no page scroll, stable Konling dock position, and independent visual audit approval.

## Impact

- Affected code: `src/features/knowledge/knowledge-graph-system.tsx`, `src/features/knowledge/resource-panel/resource-panel.tsx`, `src/features/knowledge/graph/*`, `src/components/shared/page-floating-controls.tsx`, `src/components/ai/global-ai-sidebar.tsx`, and `src/app/globals.css`.
- Affected tests and evidence: commercial UI governance checks, Playwright visual/interaction evidence for `/knowledge`, and independent visual review subagent evidence.
- No data model, graph payload, ResourceNode, path planner, RAG, or Graph Center action semantics change in this proposal.

## Context

The current `/knowledge` route uses the platform shell, but the graph still carries local controls as scattered cards and a narrow right drawer. Product Design produced three relevant concept references stored in `artifacts/product-design-audits/knowledge-graph-2026-06-14/concepts/`.

This change translates those concepts into implementation constraints rather than treating the images as screenshots to copy.

## Goals / Non-Goals

**Goals:**

- Make graph canvas the primary workspace surface.
- Collapse directory, filters, legend, view mode, layout, and focus controls into a coherent local tool system.
- Give the selected node a stable, readable inspector hierarchy.
- Preserve light/dark parity and alignment with AppShell, Arena, and virtual simulation shell directions.

**Non-Goals:**

- Implement global AppShell navigation persistence.
- Implement Konling runtime context.
- Redesign relation taxonomy or graph visual grammar already covered by archived specs.

## Concept Adoption

### Adopt

- From `layered-research-atlas.png`: semantic cluster territories, compact left-side local graph tool access, fine relation lines, and a stable right inspector.
- From `night-bridge-semantic-map.png`: dark-mode depth, restrained glow, premium control surfaces, and a calm selected-node inspector.
- From `daylight-engineering-atlas.png`: light-mode readability, white-space discipline, compact grouped controls, and clearer inspector hierarchy.

### Do Not Adopt

- Do not copy generated role switchers, standalone headers, or navigation structures that diverge from the shared AppShell.
- Do not make the generated node coordinates, labels, icon choices, or exact visual assets mandatory.
- Do not duplicate the right-bottom Konling assistant inside the inspector; Konling remains a shared dock entry.
- Do not keep a permanent expanded chapter/filter panel that competes with the graph canvas.

## Decisions

### 1. Local tools become a graph command system

Directory, filters, legend, view toggle, fit view, relayout, pin, and focus controls should live in one coherent local tool system. Default state is compact, with summaries visible and detailed controls opening as popovers, panels, or sheets.

Alternative considered: keep separate floating cards. That preserves the current visual fragmentation.

### 2. The inspector is a stable product surface

On desktop, the selected-node panel should behave like an inspector rail with predictable width, clear hierarchy, and controlled infograph preview. On mobile, it should become a sheet/drawer rather than a narrow overlay.

Alternative considered: keep the current narrow overlay. That makes infographs and learning actions hard to scan and contributes to graph competition.

### 3. AppShell remains the global frame

The concepts show top and side navigation, but implementation must use the existing AppShell contract. The design direction is adopted at the level of visual hierarchy and workspace organization, not as a new shell.

## Risks / Trade-offs

- Compact tools can reduce discoverability. Mitigation: keep active summaries visible and use clear Chinese labels in opened panels.
- Inspector width can reduce graph canvas width. Mitigation: reserve predictable space or overlay only when necessary; avoid sudden layout changes.
- Concept references may tempt pixel copying. Mitigation: tasks require explicit adoption and rejection notes in implementation evidence.

## Migration Plan

1. Define a `KnowledgeGraphToolbar` or equivalent local command system.
2. Move directory, filters, legend, view, layout, and focus controls into compact open/closed states.
3. Redesign the selected-node inspector hierarchy and responsive behavior.
4. Capture light/dark, desktop/mobile, default/open/selected-node evidence.

## Dependencies

- Depends on `persist-app-shell-navigation-preference` for default available workspace width.
- Should follow or coordinate with `stabilize-knowledge-graph-interaction-state` so inspector open/close does not relayout the graph.

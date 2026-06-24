## Overview

This change treats `/knowledge` as a canvas-first workspace. The graph canvas should retain a stable viewport-sized drawing area while local tools and selected-node details float above it. Local panels become workspace overlays, not layout columns, and the shared Konling dock remains governed by global floating dock rules rather than by graph tool state.

## Current Problems

- The top local tools are positioned relative to the graph canvas, which itself sits inside a page container. The perceived left gap therefore changes with page padding and canvas width.
- `relation-filters` is rendered through a separate absolute panel branch, while directory, legend, and view use the command panel shell. This creates inconsistent panel placement and widths.
- The selected-node detail panel uses `lg:relative` and `data-knowledge-inspector="stable-rail"`, so opening it reduces graph width and can change the visible graph center.
- The graph workspace can create route/page scrolling. That competes with browser zoom, canvas wheel zoom, and AppShell scrolling expectations.
- Local tool panels, the right-side inspector, and the Konling dock do not have one explicit collision model.

## Target Layout Model

### Canvas Workspace

- `/knowledge` should render a viewport-bound graph workspace under AppShell.
- The graph canvas area should use stable dimensions derived from the workspace viewport, not from whether the inspector is open.
- Route/page overflow should be hidden for the graph workspace. Any scrollable content belongs inside a specific overlay panel, not the page.

### Local Tool Shell

- Directory, filter, legend, and view all use a shared shell, for example `KnowledgeLocalToolShell`.
- The shell is anchored to the AppShell content edge or workspace edge with a fixed tokenized inset, such as `var(--knowledge-workspace-inset)`.
- The shell does not use canvas width to compute left/right gaps. A 1365px viewport and a wide desktop viewport should show the same edge inset.
- Panels share width, radius, shadow, backdrop, close affordance, keyboard handling, `aria-controls`, and focus return behavior.
- Filter content must not be a separately floating card. It should use the same panel slot as directory, legend, and view.

### Floating Inspector

- The selected-node detail panel becomes a floating inspector anchored to the right workspace edge.
- It should use a bounded width such as `clamp(22.5rem, 30vw, 28.75rem)` but should not participate in the graph workspace flex layout.
- Opening and closing the inspector must not change graph canvas width, graph zoom, node coordinates, selected node, or Konling dock position.
- The inspector should be tight to the right edge of the workspace safe area. Any gap should be the same fixed inset as the local panel system, not a byproduct of page max-width.

### Shared Floating Tools

- Right-bottom floating tools remain globally governed.
- Opening directory/filter/legend/view or selected-node inspector must not move the Konling collapsed button.
- If an expanded Konling panel conflicts with the inspector, the collision rule should affect the expanded panel placement only. The collapsed dock button remains visually stable.

## Validation Strategy

- Capture `/knowledge` screenshots for default, each local tool opened, selected-node inspector opened, combined stress state, light/dark theme, and mobile.
- Record DOM metrics for graph canvas, command shell, active panel, inspector, Konling dock button, and page scroll dimensions.
- Compare default and inspector-open graph canvas dimensions; they must remain stable.
- Compare default and local-tool-open Konling dock button position; it must remain stable.
- Verify `document.scrollingElement.scrollHeight <= window.innerHeight + tolerance` for the graph workspace state, except where browser chrome or AppShell route frame creates known external bounds.
- Run an independent visual review subagent against screenshots, metrics, changed files, and this change's acceptance criteria. BLOCK findings prevent completion.

## Non-Goals

- This change does not add Graph Center action payloads.
- This change does not alter graph data, relation semantics, ResourceNode readiness, planner behavior, or Konling answer generation.
- This change does not redesign the AppShell navigation system outside the `/knowledge` workspace constraints required for stable graph panels.

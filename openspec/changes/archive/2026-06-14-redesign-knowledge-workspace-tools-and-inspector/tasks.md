## 1. Local Tool System

- [x] 1.1 Inventory current directory, filter, legend, view, layout, focus, and resource panel controls on `/knowledge`.
- [x] 1.2 Define a compact local tool system with explicit default, open, closed, and mobile states.
- [x] 1.3 Move chapter directory and relation filters into on-demand controls with active summaries visible while closed.
- [x] 1.4 Integrate relation legend, 2D/3D view mode, fit view, relayout, pin, and focus commands into the same local tool language.

## 2. Inspector Redesign

- [x] 2.1 Replace the narrow selected-node overlay with a stable desktop inspector rail or approved overlay rule.
- [x] 2.2 Define inspector sections for header, semantic metadata, summary, infograph preview, relation overview, learning actions, and evidence sources.
- [x] 2.3 Ensure inspector content updates without whole-panel remount flicker.
- [x] 2.4 Provide mobile sheet/drawer behavior with graph pan/zoom still reachable when collapsed.

## 3. Visual Direction

- [x] 3.1 Use `layered-research-atlas.png` for graph organization and local tool compactness.
- [x] 3.2 Use `night-bridge-semantic-map.png` for dark-mode tone without copying its standalone shell.
- [x] 3.3 Use `daylight-engineering-atlas.png` for light-mode clarity without copying expanded navigation defaults.
- [x] 3.4 Document any implementation deviations from the concept references in the evidence artifact.

## 4. Verification

- [x] 4.1 Add tests or DOM checks for compact default tools, open state preservation, and active summaries.
- [x] 4.2 Add tests or component checks for inspector hierarchy and responsive state metadata.
- [x] 4.3 Capture browser evidence for default graph, opened tools, selected-node inspector, light/dark themes, and 320px mobile.
- [x] 4.4 Run `rtk openspec validate redesign-knowledge-workspace-tools-and-inspector --strict`.

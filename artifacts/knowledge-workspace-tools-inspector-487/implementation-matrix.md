# Knowledge Workspace Tools And Inspector Evidence

Date: 2026-06-14
Change: `redesign-knowledge-workspace-tools-and-inspector`
Issue: #487
Route: `/knowledge`

## Design Source Of Truth

- Handoff: `artifacts/product-design-audits/knowledge-graph-2026-06-14/design-handoff.md`
- Concepts:
  - `artifacts/product-design-audits/knowledge-graph-2026-06-14/concepts/layered-research-atlas.png`
  - `artifacts/product-design-audits/knowledge-graph-2026-06-14/concepts/night-bridge-semantic-map.png`
  - `artifacts/product-design-audits/knowledge-graph-2026-06-14/concepts/daylight-engineering-atlas.png`

## Concept Adoption

| Source | Adopted | Not Adopted |
| --- | --- | --- |
| `layered-research-atlas.png` | Canvas-first workspace, compact local graph commands, stable right inspector framing. | Generated labels, exact node positions, standalone navigation shell. |
| `night-bridge-semantic-map.png` | Restrained dark-mode surface depth, calm inspector rhythm, semantic relation legend emphasis. | Role switcher, separate page chrome, duplicate assistant surface. |
| `daylight-engineering-atlas.png` | Light-mode readability, grouped command buttons, clearer inspector hierarchy. | Expanded platform navigation default, pixel-level graph arrangement. |

## Implementation Matrix

| Requirement | Implementation Evidence |
| --- | --- |
| Compact local graph tools by default | `src/features/knowledge/knowledge-graph-system.tsx` uses `data-knowledge-desktop-command-system="compact"` and `desktopActiveTool` with no permanent desktop directory rail. |
| Active summaries visible while tools are closed | Desktop command surface exposes `data-knowledge-local-tool-summary="desktop"`, `data-knowledge-active-filter-summary`, visible node count, relation count, density, and active filter summary. |
| Directory, filters, legend, view, layout, and focus share one local language | Command triggers use `data-knowledge-command-trigger={item.id}` for directory, filters, legend, and view/layout; layout commands remain under `data-knowledge-layout-control`. |
| Mobile local tools retain view and layout commands | The mobile command surface includes `view-layout`, renders `data-knowledge-mobile-drawer="view-layout"`, and keeps fit view, relayout, pin, focus, and clear-pins controls available below 1024px. |
| Selected node uses stable inspector hierarchy | `src/features/knowledge/resource-panel/resource-panel.tsx` exposes `data-knowledge-inspector="stable-rail"` and section markers for header, metadata, summary, infograph, relation overview, learning actions, and evidence sources. |
| Mobile sheet behavior keeps graph reachable when collapsed | Inspector uses `data-knowledge-inspector-responsive="desktop-rail-mobile-sheet"` with fixed bottom sheet on mobile and rail only at `lg`. Local tools keep the existing mobile command surface. |
| Async detail updates do not overwrite current selection | Existing identity-aware fetch ownership remains: `nodeDetailOwnerId === selectedNode.id` gates displayed details and stale responses are aborted. |

## Verification To Complete

- [x] `rtk npm run test:unit -- src/features/knowledge/__tests__/knowledge-graph-interaction-state.test.ts`
- [x] `rtk npm run lint`
- [x] Browser evidence for default graph, opened tools, selected inspector, light/dark, and 320px mobile.
  - `artifacts/knowledge-workspace-tools-inspector-487/desktop-default-compact-dark.png`
  - `artifacts/knowledge-workspace-tools-inspector-487/desktop-open-filters-dark.png`
  - `artifacts/knowledge-workspace-tools-inspector-487/desktop-selected-inspector-light.png`
  - `artifacts/knowledge-workspace-tools-inspector-487/mobile-320-selected-sheet-dark.png`
  - `artifacts/knowledge-workspace-tools-inspector-487/mobile-320-view-layout-dark.png`
  - `artifacts/knowledge-workspace-tools-inspector-487/browser-evidence.json`
- [x] `rtk openspec validate redesign-knowledge-workspace-tools-and-inspector --strict`
- [x] `rtk npx tsx scripts/tests/test-commercial-ui-governance.ts`

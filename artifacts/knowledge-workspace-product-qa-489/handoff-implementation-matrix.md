# Knowledge Workspace Product QA Matrix

Change: `govern-knowledge-workspace-product-qa`
Issue: #489
Route: `/knowledge`
Design source of truth: `artifacts/product-design-audits/knowledge-graph-2026-06-14/design-handoff.md`

## Source References

- `artifacts/product-design-audits/knowledge-graph-2026-06-14/design-handoff.md`
- `artifacts/product-design-audits/knowledge-graph-2026-06-14/concepts/README.md`
- `artifacts/product-design-audits/knowledge-graph-2026-06-14/concepts/layered-research-atlas.png`
- `artifacts/product-design-audits/knowledge-graph-2026-06-14/concepts/night-bridge-semantic-map.png`
- `artifacts/product-design-audits/knowledge-graph-2026-06-14/concepts/daylight-engineering-atlas.png`

## Adopted Guidance

- `layered graph organization`: the semantic map uses graph regions, bounded node scale, and restrained relation lines instead of a dense bright network mass.
- `premium dark visual tone`: dark screenshots keep the platform shell, subdued graph canvas, local tool cluster, stable inspector, and right-bottom dock in the same product surface.
- `light-mode clarity`: light screenshots verify that graph canvas, inspector hierarchy, local tools, and dock remain legible with platform tokens.

## Rejected Generated Details

- `standalone shell duplication`: the page keeps the shared AppShell and does not add a second global navigation frame.
- `generated role switchers`: route-level role switching is not copied from concept mockups.
- `exact mock labels`: generated concept labels are treated as visual direction, not product copy.
- `exact node positions`: graph node positions remain runtime-derived and interaction-stable rather than copied from generated images.
- `duplicate assistant regions`: Konling stays in the shared right-bottom dock; no second assistant panel is introduced in the graph workspace.

## Merged Product Direction

- `shared AppShell + local graph tools + right-bottom Konling dock`: the final workspace combines platform navigation, compact graph-local controls, stable selected-node inspector, semantic relation map, and shared Konling dock.

## Required QA States

- Desktop default collapsed navigation, dark theme.
- Desktop expanded navigation preference, dark theme.
- Desktop local legend and relation tool state.
- Desktop selected-node inspector, light theme.
- Hover, click, drag, pinned coordinates, and explicit relayout state.
- Konling selected context, no-selection context, and degraded unresolved-node context.
- Mobile 320px local tools, selected-node inspector, and expanded Konling dock.
- Combined stress state with expanded AppShell, open local tool, selected inspector, and expanded Konling dock.

## Evidence

- Browser evidence: `artifacts/knowledge-workspace-product-qa-489/browser-evidence.json`
- Screenshots: `artifacts/knowledge-workspace-product-qa-489/*.png`
- Independent visual review: `artifacts/knowledge-workspace-product-qa-489/visual-review.md`

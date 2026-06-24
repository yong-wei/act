# Adaptive Path Product QA Matrix

Change: `govern-adaptive-path-product-qa`

Design source: `artifacts/product-design-audits/adaptive-learning-path-2026-06-14/design-handoff.md`

## Concept Alignment

| Source | Adopted | Merged | Rejected |
| --- | --- | --- | --- |
| `concepts/01-path-generation-main.png` | Path generation workspace, cold-start language, Konling parameter semantics, goal and resource preference controls. | Uses the platform AppShell, shared breadcrumb/header/account controls, and right-bottom Konling dock instead of standalone mock chrome. | Fixed `control-correction` copy, internal readiness/debug states, duplicate assistant region. |
| `concepts/02-path-selection-comparison.png` | Resource icon semantics, route map semantics, comparable path information density. | Comparison uses an information grid/list so paths remain comparable inside the real AppShell. | Three isolated marketing cards and mock-only decorative chrome. |
| `concepts/03-active-path-execution.png` | Current path execution, full route map, current node emphasis, node detail, checkpoint/resource distinction. | Execution state is combined with governed resource-node launch and history actions from the implemented page. | A single next-step-only layout or resource list without checkpoint semantics. |
| `concepts/04-history-evidence-record.png` | History timeline, evidence-source labels, review/continue interactions, student-safe evidence states. | Evidence record appears as a task-first timeline within the same path center page. | Admin diagnostics, raw policy names, raw reason codes, or operations-style tables. |

## Required Route And State Matrix

| ID | Route | Goal | Viewport | Theme | Navigation | Dock | Page state | Source concept | Screenshot |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `generation-main-desktop-light` | `/assessment/adaptive-practice` | `frequency-response-foundations` | desktop | light | desktop collapsed | collapsed | generation main | `01-path-generation-main.png` | `artifacts/commercial-ui/adaptive-path-product-qa-516/generation-main-desktop-light.png` |
| `generation-main-mobile-dark` | `/assessment/adaptive-practice` | `frequency-response-foundations` | mobile | dark | workspace command surface | collapsed | generation main | `01-path-generation-main.png` | `artifacts/commercial-ui/adaptive-path-product-qa-516/generation-main-mobile-dark.png` |
| `konling-parameter-panel-desktop-dark` | `/assessment/adaptive-practice` | `frequency-response-foundations` | desktop | dark | desktop collapsed | expanded | Konling parameter panel | `01-path-generation-main.png` | `artifacts/commercial-ui/adaptive-path-product-qa-516/konling-parameter-panel-desktop-dark.png` |
| `cold-start-starter-paths-mobile-light` | `/assessment/adaptive-practice` | `frequency-response-foundations` | mobile | light | workspace command surface | collapsed | cold-start starter paths | `01-path-generation-main.png` | `artifacts/commercial-ui/adaptive-path-product-qa-516/cold-start-starter-paths-mobile-light.png` |
| `path-comparison-desktop-light` | `/assessment/adaptive-practice` | `control-correction` | desktop | light | desktop collapsed | collapsed | comparable path options | `02-path-selection-comparison.png` | `artifacts/commercial-ui/adaptive-path-product-qa-516/path-comparison-desktop-light.png` |
| `path-comparison-mobile-dark` | `/assessment/adaptive-practice` | `control-correction` | mobile | dark | workspace command surface | collapsed | comparable path options | `02-path-selection-comparison.png` | `artifacts/commercial-ui/adaptive-path-product-qa-516/path-comparison-mobile-dark.png` |
| `active-path-execution-desktop-light` | `/assessment/adaptive-practice` | `control-correction` | desktop | light | desktop collapsed | collapsed | active path execution | `03-active-path-execution.png` | `artifacts/commercial-ui/adaptive-path-product-qa-516/active-path-execution-desktop-light.png` |
| `active-path-execution-mobile-dark` | `/assessment/adaptive-practice` | `control-correction` | mobile | dark | workspace command surface | collapsed | active path execution | `03-active-path-execution.png` | `artifacts/commercial-ui/adaptive-path-product-qa-516/active-path-execution-mobile-dark.png` |
| `node-detail-desktop-light` | `/assessment/adaptive-practice` | `control-correction` | desktop | light | desktop collapsed | collapsed | selected or completed node detail | `03-active-path-execution.png` | `artifacts/commercial-ui/adaptive-path-product-qa-516/node-detail-desktop-light.png` |
| `skip-warning-desktop-light` | `/assessment/adaptive-practice` | `control-correction` | desktop | light | desktop collapsed | collapsed | skip warning | `03-active-path-execution.png` | `artifacts/commercial-ui/adaptive-path-product-qa-516/skip-warning-desktop-light.png` |
| `history-evidence-desktop-light` | `/assessment/adaptive-practice` | `control-correction` | desktop | light | desktop collapsed | collapsed | history and evidence timeline | `04-history-evidence-record.png` | `artifacts/commercial-ui/adaptive-path-product-qa-516/history-evidence-desktop-light.png` |
| `history-evidence-mobile-dark` | `/assessment/adaptive-practice` | `control-correction` | mobile | dark | workspace command surface | collapsed | history and evidence timeline | `04-history-evidence-record.png` | `artifacts/commercial-ui/adaptive-path-product-qa-516/history-evidence-mobile-dark.png` |
| `app-shell-expanded-dock-desktop-dark` | `/assessment/adaptive-practice` | `control-correction` | desktop | dark | desktop expanded | expanded | AppShell and dock stress state | `03-active-path-execution.png` | `artifacts/commercial-ui/adaptive-path-product-qa-516/app-shell-expanded-dock-desktop-dark.png` |

## Functional Gates

- Cold-start users can generate and select an executable starter path.
- Generation remains generic and is not fixed to `control-correction`.
- Paths include governed resource nodes and at least one checkpoint.
- Student-visible UI and accessible text exclude forbidden engineering strings.
- Generation, selection, rejection, switching, start, completion, review, continued interaction, skip, return, checkpoint, Konling adjustment, and external-resource access are governed.
- Completed-node continued interaction does not double-count the first completion.
- Desktop uses fluid AppShell workspace regions.
- Mobile uses task-first panels rather than squeezed desktop sidebars, tables, or multi-column layouts.
- Path comparison remains a comparable list/grid, not isolated marketing cards.
- Breadcrumbs, account controls, theme controls, and the shared right-bottom Konling dock remain platform-level UI.

## Temporary Exceptions

None.

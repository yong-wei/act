# Virtual Simulation Handoff Implementation Matrix

Change: `align-virtual-simulation-product-design-handoff`
Source of truth: `artifacts/product-design-audits/virtual-simulation-2026-06-13/design-handoff.md`

## Compatibility Decision

`/virtual-lab` uses the handoff-approved redirect role. It redirects to `/simulations`, so `/simulations` remains the canonical catalog and open-state source.

## Adopted Decisions

| Handoff section | Concept reference | Implemented surface | Evidence hook |
| --- | --- | --- | --- |
| Virtual simulation catalog | `concept-1-platform-continuity.png` | `/simulations` uses `AppShell`, breadcrumb, search, difficulty filter, catalog mode tabs, list-first browsing, and card fallback. | `data-product-design-concept-reference="concept-1-platform-continuity"` |
| Canonical entry hierarchy | `concept-1-platform-continuity.png` | `/virtual-lab` redirects to `/simulations`; catalog marks the compatibility role as `redirect-to-simulations`. | `data-virtual-lab-compatibility-role="redirect-to-simulations"` |
| Command-deck shell | `concept-2-command-deck-shell.png` | `/simulations/*` shell marks scene primacy, glass command surfaces, collapsible edge panels, hint strip, and bottom tools. | `data-command-deck-composition="scene-primary-glass-panels-bottom-tools"` |
| Collapsible local panels | `concept-2-command-deck-shell.png` | Shared simulation docks expose labeled restore handles, default to collapsed on mobile, and keep local tools below the scene in mobile flow without covering the first viewport. | `data-simulation-panel-restore-handle` |
| Learning mission semantics | `concept-3-learning-mission-studio.png` | `/interactive-learning/control-workbench` exposes current objective, task chain, evidence/submission state, and next action from the resolved workbench session. | `data-learning-mission-semantics="objective-task-chain-evidence-next-action"` |

## Rejected Details Kept Out

| Rejected detail | Enforcement surface |
| --- | --- |
| Student-facing model deployment status or version state | `/simulations` shows task fit, difficulty, recent context, and launch action instead of deployment columns. |
| Page-local student/teacher role switching | Catalog, detail shell, and workbench retain platform user-center actions only. |
| Duplicate right-side Konling assistant region | Detail shell and workbench use shared floating dock metadata and do not add a page-local assistant column. |
| Pixel-perfect concept copying | Implementation uses concept references through this matrix and `design-handoff.md` rather than copying generated image details. |

## Representative Routes

- Catalog: `/simulations`
- Compatibility entry: `/virtual-lab`
- Heading-control detail: `/simulations/destroyer`
- DP/positioning detail: `/simulations/drilling`
- Course-oriented simulation detail: `/simulations/cruise`
- Concept 3 acceptance sample: `/interactive-learning/control-workbench`

## Visual Evidence

- Catalog: `implementation-screenshots/simulations-dark-1440.png`, `implementation-screenshots/simulations-light-1440.png`, `implementation-screenshots/simulations-mobile-dark-390.png`
- Compatibility redirect: `implementation-screenshots/virtual-lab-redirect-dark-1440.png`
- Simulation detail shell: `implementation-screenshots/destroyer-dark-1440.png`, `implementation-screenshots/destroyer-light-1440.png`, `implementation-screenshots/destroyer-mobile-dark-390.png`, `implementation-screenshots/destroyer-dark-collapsed-panels-1440.png`, `implementation-screenshots/drilling-dark-1440.png`
- Concept 3 acceptance sample: `implementation-screenshots/workbench-dark-1440.png`, `implementation-screenshots/workbench-light-1440.png`

## Verification Result

- Independent UI flow review initially blocked on mobile detail pages because panels occupied the first viewport and the bottom toolbar was not visible.
- The blocking item was fixed by default-collapsing mobile docks, keeping restore handles visible, placing the hint strip above the bottom toolbar, and preserving local tools below the scene for mobile flow.
- Re-review result: PASS. The updated `destroyer-mobile-dark-390.png` shows scene primacy, collapsed panel handles, hint placement above the toolbar, and a visible bottom toolbar.
- Fresh commands passed: `rtk npm run lint`; `rtk npm run test`; `rtk npm run test:unit -- src/features/control-workbench/__tests__/control-workbench-shell.test.ts src/lib/__tests__/commercial-ui-governance.test.ts`; `rtk npx tsx scripts/tests/test-commercial-ui-governance.ts`; `rtk openspec validate align-virtual-simulation-product-design-handoff --strict`; `rtk git diff --check`.

## Residual Risk

This change aligns the representative catalog, compatibility, detail shell, and workbench surfaces to the handoff. Final series QA must use these screenshots and data markers as the new baseline instead of the earlier incomplete virtual simulation UI state.

## Why

The audit repeatedly shows mobile widths larger than the viewport, long pages without fixed primary actions, floating tools covering content, missing focus containment, unnamed controls, and absent `alert/live` feedback. These are platform shell problems that cut across student, teacher, admin, AI, Arena, and simulation surfaces.

## What Changes

- Define mobile task layout rules for 320px/390px audited breakpoints.
- Replace wide tables and unbounded long-page actions with responsive cards, pagination, and fixed primary action zones.
- Add floating dock safe-area and layering rules for page content, local tools, AI sidebars, and simulation controls.
- Add modal/dialog focus containment, Escape handling, and accessible naming remediation for audited surfaces.
- Update audit status after responsive and a11y evidence passes.

## Capabilities

### New Capabilities
- `audit-remediation-mobile-a11y-shell`: audit remediation contract for mobile shell, responsive task layout, focus, naming, and status accessibility.

### Modified Capabilities
- None. This proposal coordinates platform shell and page-specific adoption under one audit remediation contract.

## Impact

- Affects AppShell, floating tools, Global AI surfaces, dialogs, admin tables, teacher reports, simulations, knowledge graph, Arena, and evidence pages.
- Evidence references include `report.md` step findings, `chapters/49-function-state-flows-batch41.md`, `chapters/53-function-state-flows-batch45.md`, `chapters/54-function-state-flows-batch46.md`, and `chapters/57` through `67`.

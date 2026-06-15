## Why

This adaptive path redesign spans planner contracts, resource nodes, Konling tools, generation UI, execution UI, history, evidence, AppShell, and visual quality. A final product QA change is needed so the series cannot close unless the implemented experience visibly matches the accepted handoff and concept images.

## What Changes

- Add a final adaptive path product QA matrix across generation, comparison, execution, history, evidence, Konling, cold start, generic goals, resource icons, skip warning, data governance, AppShell, themes, and mobile.
- Treat `artifacts/product-design-audits/adaptive-learning-path-2026-06-14/design-handoff.md` and four concept images as the authoritative visual baseline.
- Require browser evidence produced by a subagent and an independent visual review subagent PASS before completion.
- Fail on forbidden student-visible strings and on generation fixed to `control-correction`.
- Require every child change in this series to have passed its own OpenSpec validation and visual/data gates.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `commercial-ui-governance-gates`: add final adaptive path center QA gates.
- `adaptive-learning-center-ui`: require integrated product acceptance across all adaptive path surfaces.
- `commercial-student-entry-surfaces`: require adaptive path center to satisfy student entry and mobile task-first standards.

## Impact

- Affects visual evidence scripts, governance tests, review checklists, final QA reports, and issue closeout.
- Depends on all prior changes in this series.
- Does not implement feature code directly.

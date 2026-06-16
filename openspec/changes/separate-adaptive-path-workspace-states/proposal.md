## Why

The path center currently collapses landing, generation, selection, execution, and evidence review into one page shape. The design requires one main task per route intent so students do not jump from a generated path to preset goals, hidden current paths, and unrelated history sections in the same scroll.

## What Changes

- Add a route-intent state model for landing, generation, selection, execution, and evidence review.
- Make each intent render one primary workspace and only lightweight secondary actions.
- Preserve selected path context across route changes and returns from launched resources.
- Add responsive desktop and mobile layouts aligned to the accepted visual sources.
- Add visual QA gates that compare implementation screenshots against expected visuals and current-state evidence.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `adaptive-learning-center-ui`: require route-intent state isolation and task-first responsive layouts.
- `commercial-ui-governance-gates`: require design-contract QA evidence for the adaptive path closed-loop states.

## Impact

- Affects `/assessment/adaptive-practice` route handling, query intent handling, path context restoration, AppShell workspace layout, mobile responsive behavior, and adaptive path visual governance.
- Expected visual sources: all four Product Design concepts under `artifacts/product-design-audits/adaptive-learning-path-2026-06-14/concepts/`.
- Current-state evidence: `artifacts/product-design-audits/adaptive-learning-path-2026-06-16-current-audit/*.png`.

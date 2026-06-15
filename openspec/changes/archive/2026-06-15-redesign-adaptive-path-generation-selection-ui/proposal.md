## Why

The current adaptive practice page exposes fixed control-correction wording and internal readiness strings, while the accepted design requires a premium, generic path-generation and comparison experience. This change owns the student-facing generation and selection UI using the handoff and concept images as visual acceptance truth.

## What Changes

- Redesign `/assessment/adaptive-practice` entry into `自适应学习路径中心`.
- Implement the path generation main interface from `concepts/01-path-generation-main.png`.
- Implement path option comparison using `concepts/02-path-selection-comparison.png` as the comparison source and use `concepts/03-active-path-execution.png` only for current-path preview continuity.
- Keep AppShell navigation default-collapsed and persistent, breadcrumbs visible, theme/account controls unified, and Konling as the right-bottom floating dock.
- Add browser visual validation by subagent against the handoff and concept images before the change can complete.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `adaptive-learning-center-ui`: replace the control-correction-specific generation/selection surface with a generic path center UI.
- `commercial-student-entry-surfaces`: make adaptive learning a full learning-atlas entry rather than a fixed practice page.
- `commercial-ui-governance-gates`: require design-qa evidence for this adaptive path generation and selection UI.

## Impact

- Affects `/assessment/adaptive-practice`, adaptive center components, AppShell route metadata, Konling dock context, and visual QA artifacts.
- Depends on generic path generation, governed resource-node icons, and Konling path tools.
- Does not own execution timeline/history pages; those are handled by `build-adaptive-path-execution-history-ui`.

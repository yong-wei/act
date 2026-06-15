## Why

The previous virtual simulation and knowledge graph series showed a recurring risk: proposals cited Product Design concepts, but individual implementation changes could complete without a hard visual match gate. Interactive learning needs an explicit final governance change that verifies every child change has passed design-qa against the accepted handoff and concepts.

## What Changes

- Add an interactive learning product QA matrix covering atlas, course entry, teacher waiting, student/guest runtime, teacher projection runtime, module chrome, AppShell continuity, Konling dock, themes, mobile, and accessibility.
- Treat `artifacts/product-design-audits/interactive-learning-2026-06-14/design-handoff.md` as the design source of truth.
- Require every child change in this series to include its own design-qa report with `final result: passed`.
- Require final QA to aggregate those reports and run an independent visual review subagent before completion.
- Reject evidence that only proves token usage, route registration, or nonblank screenshots when the visible result contradicts the handoff.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `commercial-ui-governance-gates`: define final product QA gates for the interactive learning and interactive course redesign.

## Impact

- Affects visual evidence scripts, governance tests, QA reports, and review checklist.
- Depends on atlas, course entry, classroom waiting, runtime shell, and module visual standard changes.
- Also depends on `persist-app-shell-navigation-preference` while that external shell preference change remains active.
- Does not implement UI migration itself.

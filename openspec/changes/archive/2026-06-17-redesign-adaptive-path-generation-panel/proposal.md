## Why

The current path generation surface looks like a static page state rather than a usable generator. The design contract requires an editable Konling-assisted generation panel where students choose goal, time, rhythm, resource preferences, checkpoint density, external-resource permission, and natural-language intent before the planner generates comparable paths.

## What Changes

- Replace static generation summaries with a real path generation task panel.
- Make generation parameters editable and pass them to the governed path-generation tool.
- Preserve the shared right-bottom Konling dock while keeping generation controls inside the task panel.
- Return three comparable path options with explicit resource mix, checkpoint, recommendation reason, readiness state, and action controls.
- Treat the 2026-06-14 Product Design handoff and 2026-06-16 closed-loop design as acceptance inputs.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `adaptive-learning-center-ui`: add the editable generation panel and comparable option contract.
- `adaptive-learning-path-planning`: accept structured generation request parameters and produce display-ready path option bundles.
- `konling-agent-runtime`: consume form-derived generation parameters for path-advisor tool calls rather than relying on freeform chat alone.

## Impact

- Affects `/assessment/adaptive-practice`, path generation request builders, Konling path-advisor tool invocation, planner option payloads, and visual QA evidence.
- Expected visual sources: `artifacts/product-design-audits/adaptive-learning-path-2026-06-14/concepts/01-path-generation-main.png` and `02-path-selection-comparison.png`.
- Current mismatch evidence: `artifacts/product-design-audits/adaptive-learning-path-2026-06-16-current-audit/audit-notes.md`.

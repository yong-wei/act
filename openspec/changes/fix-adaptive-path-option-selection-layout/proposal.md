## Why

The generated path selection view currently separates comparable path information from the matching action buttons on desktop. Students must visually match a path column to a detached action area, which breaks the approved path-selection design and makes choosing the intended path error-prone.

## What Changes

- Replace the desktop comparison table/action-strip split with comparable route modules where each path keeps its action controls inside the same visual and DOM container as its content.
- Preserve direct cross-path comparison by aligning the same information fields across modules rather than turning options into isolated marketing cards.
- Add hard visual QA against the adaptive path Product Design handoff, especially the path-selection comparison concept and current audit notes.
- Preserve existing governed select, adjust, reject, and explain actions.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `adaptive-learning-center-ui`: tighten the generated path option selection contract so each option remains comparable while its actions stay attached to the option.

## Impact

- Affects `/assessment/adaptive-practice` path-selection rendering, responsive layout, keyboard focus order, and selection action placement.
- Does not change planner scoring, path persistence, launch behavior, or completion write-back.
- Requires visual evidence against `artifacts/product-design-audits/adaptive-learning-path-2026-06-14/design-handoff.md`, `02-path-selection-comparison.png`, and the 2026-06-16 current audit.

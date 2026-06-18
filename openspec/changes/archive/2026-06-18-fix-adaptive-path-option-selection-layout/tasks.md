## 1. Selection Layout

- [x] 1.1 Replace the desktop comparison table/action-strip split with comparable route modules.
- [x] 1.2 Keep estimated duration, resource mix, readiness, checkpoints, recommendation reason, expected result, and risk note in the same order for every option.
- [x] 1.3 Move select, adjust, reject, and explain controls into the corresponding option module.
- [x] 1.4 Preserve mobile task-first layout without duplicating desktop-only action strips.

## 2. Interaction and Accessibility

- [x] 2.1 Ensure keyboard focus traverses one option's content and actions before the next option.
- [x] 2.2 Ensure button labels and accessible names identify the owning path option.
- [x] 2.3 Preserve governed path activity calls for select, adjust, reject, and explain actions.

## 3. Validation

- [x] 3.1 Run `rtk openspec validate fix-adaptive-path-option-selection-layout --strict`.
- [x] 3.2 Run targeted tests for path option rendering and action dispatch.
- [x] 3.3 Capture desktop and mobile browser evidence for path selection.
- [x] 3.4 Compare evidence against `design-handoff.md`, `02-path-selection-comparison.png`, and the 2026-06-16 current audit.
- [x] 3.5 Obtain independent visual or UI-flow review confirming no detached option action strip remains.

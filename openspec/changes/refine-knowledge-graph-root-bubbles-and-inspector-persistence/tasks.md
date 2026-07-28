## 1. Root bubble contracts

- [x] 1.1 Extend root label and presentation contracts for always-visible, inside, wrapped full-name labels.
- [x] 1.2 Replace root grid packing with deterministic viewport-shaped irregular collision-safe clustering and stable metadata.
- [x] 1.3 Update root layout and label-policy tests for repeatability, irregularity, zero overlap, and complete internal labels.

## 2. Renderer presentation

- [x] 2.1 Render dimensional platform-token root bubbles and centered internal labels in the 2D renderer without changing ordinary-node labels.
- [x] 2.2 Render equivalent spherical root bubbles, bounded highlight/glow, and centered internal labels in the 3D renderer.
- [x] 2.3 Add or update renderer contract tests for root bubble geometry, full labels, light/dark roles, and desktop/mobile parity.

## 3. Stable inspection interactions

- [x] 3.1 Remove manipulation-start inspector dismissal while retaining renderer-local drag, viewport, and blank-gesture behavior.
- [x] 3.2 Update 2D, 3D, direct-activation, drag-isolation, and multi-pointer regressions so manipulation preserves inspector, selection, focus, layout, and disclosure state while true blank clicks dismiss.

## 4. Inspector accordion

- [x] 4.1 Implement an accessible single-open accordion for relation overview, canonical corridor, adjacent-domain paths, and learning-path actions with all sections initially collapsed.
- [x] 4.2 Keep accordion and scroll state through manipulation and async updates, reset them on selected-node changes, and default nested relation groups to collapsed.
- [x] 4.3 Add client tests for initial state, mutual exclusion, keyboard/ARIA state, persistence, and node-change reset.

## 5. Validation and visual QA

- [x] 5.1 Run focused knowledge graph tests, typecheck, and strict OpenSpec validation; fix in-scope failures.
- [x] 5.2 Capture and inspect `/knowledge` at 1440x900 and 390x844 in light and dark themes, including root labels and inspector manipulation/accordion states.
- [x] 5.3 Obtain UI-flow and independent code review clearance for the final diff and resolve all blocking findings.

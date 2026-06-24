## 1. Route Intent Model

- [x] 1.1 Implement route-intent parsing for landing, contextual generation, selection, execution, and evidence review.
- [x] 1.2 Ensure each intent renders one primary workspace.
- [x] 1.3 Remove unreachable preset-goal cards from the landing primary task flow.

## 2. Context Restoration

- [x] 2.1 Preserve selected path id, option id, current node id, goal id, and alternatives after selection.
- [x] 2.2 Restore path context after launching and returning from resources.
- [x] 2.3 Keep generation panel closed in execution and evidence states unless explicitly opened.

## 3. Responsive Layout

- [x] 3.1 Implement desktop AppShell workspace layouts for all path states.
- [x] 3.2 Implement mobile task-first panels, sheets, or tabs for all path states.
- [x] 3.3 Verify text, buttons, and controls do not overlap at 320px and desktop widths.

## 4. Design Contract QA

- [x] 4.1 Capture screenshots for landing, generation, selection, execution, and evidence review states.
- [x] 4.2 Compare screenshots against the four expected Product Design concept images.
- [x] 4.3 Cite current-state audit screenshots and document fixed mismatches.
- [x] 4.4 Verify no student-visible engineering strings remain.
- [x] 4.5 Run `rtk openspec validate separate-adaptive-path-workspace-states --strict`.

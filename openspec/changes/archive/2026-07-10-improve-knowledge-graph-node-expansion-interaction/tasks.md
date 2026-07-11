## Tasks

- [x] Task 1: Add node-local expansion control.
  Covers: AC-1, AC-2
  Acceptance: Selecting an expandable node shows a real accessible expand/collapse button near the selected node, with loading and expanded states.
  Evidence: Component or browser test plus screenshots for collapsed, loading where practical, and expanded states.
  Reviewer Check: Confirm the bottom-left panel is not the only expansion control and keyboard focus can reach the node-local control.

- [x] Task 2: Add focused expansion layout.
  Covers: AC-3
  Acceptance: Direct children of an expanded node are arranged around that expanded node as the local center with deterministic rings or equivalent radial placement.
  Evidence: Layout unit tests or browser assertions plus screenshots of expanded top-level unit nodes.
  Reviewer Check: Confirm the layout does not produce a stretched fan from the selected node to a distant child cluster.

- [x] Task 3: Preserve layout stability and user pins.
  Covers: AC-4
  Acceptance: Expanding, collapsing, selecting, and hovering do not reset unrelated node positions, clear user-pinned positions, or invoke full fit-to-view without explicit user action.
  Evidence: Regression tests or Playwright checks for selected node, expansion state, pinned node state, and viewport stability.
  Reviewer Check: Confirm pinned node positions override automatic focused-expansion placement.

- [x] Task 4: Keep 2D and 3D graph modes coherent.
  Covers: AC-5
  Acceptance: 2D and 3D modes expose consistent expansion affordances and focused expansion behavior, or the 3D fallback is explicitly documented and visually verified.
  Evidence: Mode-switch test or browser evidence for both modes.
  Reviewer Check: Confirm 3D mode is not left with only the old bottom-left expansion workflow unless documented as a deliberate fallback.

- [x] Task 5: Run visual and accessibility validation.
  Covers: AC-6
  Acceptance: Desktop and narrow viewport screenshots in light and dark themes show the node-local control, expanded centered child layout, no dock/tool overlap, readable labels, and visible focus.
  Evidence: Visual QA artifacts and a reviewer summary.
  Reviewer Check: Confirm screenshots prove the interaction state, not only that the graph rendered.

- [x] Task 6: Run OpenSpec and Buddy validation.
  Covers: AC-7
  Acceptance: OpenSpec validation and Buddy issue-body validation pass.
  Evidence: Validation command output.
  Reviewer Check: Confirm all AC ids map to tasks and evidence.

## Validation

- [x] Run `rtk openspec validate improve-knowledge-graph-node-expansion-interaction --strict`.
- [x] Run focused tests for knowledge graph expansion interaction and layout.
- [x] Run browser visual verification for `/knowledge` with a top-level unit node selected, expanded, and collapsed.
- [x] Run Buddy issue-body validation before GitHub issue creation.

---
change_id: improve-knowledge-graph-node-expansion-interaction
claim_branch: improve-knowledge-graph-node-expansion-interaction
series: knowledge-graph-visual-clarity
coupling_group: knowledge-graph-visual-clarity
execution_mode: isolated
base_branch: integration
required_branch:
depends_on: []
parent_issue:
blocked_by: []
blocking: []
openspec_path: openspec/changes/improve-knowledge-graph-node-expansion-interaction
risk: medium
area: ui
---

## Goal

Make knowledge graph expansion discoverable and spatially coherent by placing expand/collapse controls near the selected node and arranging expanded child nodes around that node as the local center.

## Scope

- Move the primary expand/collapse affordance from the distant bottom-left panel to a node-local accessible control.
- Keep selected-node status text as fallback/context without making it the only expansion path.
- Add focused expansion layout for top-level and collapsed root node expansion.
- Preserve user-pinned node coordinates and avoid unrelated relayout.
- Validate 2D and 3D graph mode behavior, theme parity, viewport behavior, and floating-control non-overlap.

## Out of Scope

- Changing graph data loading APIs or shard semantics.
- Changing ResourceNode metadata, resource registry, path planning, or Konling citation logic.
- Redesigning the entire knowledge graph shell, inspector, filters, or global navigation.
- Replacing the graph rendering library.

## Acceptance Checklist

- [ ] AC-1: Selecting an expandable graph node shows a primary expand/collapse control near that node. Owner: independent reviewer.
  Evidence: browser/component evidence showing selected collapsed node and node-local control.
- [ ] AC-2: The node-local expansion control is accessible and stateful. Owner: independent reviewer.
  Evidence: keyboard/focus check and visible or accessible labels for collapsed, loading, expanded, and disabled states.
- [ ] AC-3: Expanding a top-level or collapsed root node arranges direct children around the expanded node as the local center. Owner: independent reviewer.
  Evidence: focused layout test or visual evidence showing centered rings/groups rather than a stretched fan.
- [ ] AC-4: Expansion, collapse, selection, hover, and inspector updates preserve unrelated graph layout and user-pinned positions. Owner: independent reviewer.
  Evidence: regression test or browser evidence for pinned/stable layout.
- [ ] AC-5: 2D and 3D graph modes remain coherent. Owner: independent reviewer.
  Evidence: mode-switch evidence or documented 3D fallback with reviewer approval.
- [ ] AC-6: Visual QA passes for theme parity, responsive behavior, local tools, shared dock, and selected-neighborhood readability. Owner: independent reviewer.
  Evidence: desktop/narrow viewport screenshots in light and dark themes where supported.
- [ ] AC-7: OpenSpec and Buddy contracts remain valid. Owner: independent reviewer.
  Evidence: `rtk openspec validate improve-knowledge-graph-node-expansion-interaction --strict` and issue-body validation pass.

## Tasks

- [ ] Task 1: Add node-local expansion control.
  Covers: AC-1, AC-2
  Acceptance: Expand/collapse is available near the selected node with reachable focus and accurate loading/expanded labels.
  Evidence: Component/browser test and screenshots.
  Reviewer Check: Confirm the bottom-left panel is no longer the only expansion control.
- [ ] Task 2: Add focused expansion layout.
  Covers: AC-3
  Acceptance: Expanded direct children are deterministically arranged around the expanded node.
  Evidence: Layout test or browser evidence.
  Reviewer Check: Confirm the result does not form a distant edge fan.
- [ ] Task 3: Preserve layout stability and pinned positions.
  Covers: AC-4
  Acceptance: Selection, expansion, collapse, hover, and inspector updates do not reset unrelated graph positions.
  Evidence: Regression test or browser trace.
  Reviewer Check: Confirm pinned positions override automatic focused placement.
- [ ] Task 4: Validate 2D and 3D mode behavior.
  Covers: AC-5
  Acceptance: Both modes expose coherent expansion behavior, or any 3D limitation is explicitly documented and accepted.
  Evidence: Browser evidence for 2D/3D mode switching.
  Reviewer Check: Confirm 3D mode is not silently left with an inferior hidden workflow.
- [ ] Task 5: Run visual QA.
  Covers: AC-6
  Acceptance: Screenshots show node-local control, centered expanded layout, no dock/tool overlap, readable labels, and theme parity.
  Evidence: Visual QA artifacts and reviewer summary.
  Reviewer Check: Confirm the screenshots demonstrate interaction states, not only static render.
- [ ] Task 6: Run validation and prepare review evidence.
  Covers: AC-7
  Acceptance: OpenSpec validation, Buddy issue-body validation, and focused tests pass.
  Evidence: Command output in implementation summary.
  Reviewer Check: Confirm every AC has linked evidence.

## Agent Guardrails

- Only execute this issue's change.
- Do not redesign the whole `/knowledge` shell or inspector.
- Do not change resource semantics, graph data APIs, path planning, or Konling citation behavior.
- Do not implement canvas-painted fake buttons as the only expansion control; use a real accessible control or justify an equivalent accessible mechanism.
- Do not reset user-pinned node positions or force a full fit-to-view as a side effect of selecting, expanding, or collapsing a node.
- Implementation agents may propose satisfied AC ids with evidence, but must not check Acceptance Checklist items themselves.
- Check AC items only after an independent reviewer confirms the linked task evidence.
- Use the claim branch named in front matter.
- Do not execute other planned OpenSpec changes.
- Stop if dependency, coupling group, or branch constraints fail.
- Stop if GitHub blockedBy relationships still contain open blockers.

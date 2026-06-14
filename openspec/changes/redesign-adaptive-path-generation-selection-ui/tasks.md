## 1. Route And Shell

- [ ] 1.1 Register `/assessment/adaptive-practice` as the adaptive path center entry with unified AppShell, breadcrumbs, theme control, account control, and shared Konling dock.
- [ ] 1.2 Ensure left navigation default-collapsed state and user-expanded preference persist across page transitions.
- [ ] 1.3 Remove page-local headers or duplicated navigation that conflict with the shared shell.

## 2. Generation Main UI

- [ ] 2.1 Implement `自适应学习路径中心` with `生成学习路径` as the main action.
- [ ] 2.2 Add learning overview fields for current goal, current node, learned time, estimated total time, and weekly progress.
- [ ] 2.3 Add Konling generation parameters for learning goal, available time, difficulty rhythm, resource preference, checkpoints, external resources, and natural-language input `告诉控灵你想达成什么`.
- [ ] 2.4 Render cold-start copy exactly as product language and never as failure state.

## 3. Path Selection UI

- [ ] 3.1 Render at least two and preferably three comparable path options: 基础补弱路径, 实践冲刺路径, and 课程同步路径 or preference-matched path.
- [ ] 3.2 Show estimated time, matched resources, checkpoints, use case, recommendation reason, expected outcome, and stable resource icons.
- [ ] 3.3 Add actions `选择路径`, `请控灵调整`, and `暂不采用`.
- [ ] 3.4 Show selection history for selected, rejected, switched, and usefulness feedback.
- [ ] 3.5 Verify path options remain a comparable list, table, or information grid; isolated three-card marketing layouts are not acceptable.

## 4. Visual And Text Gates

- [ ] 4.1 Capture browser evidence for desktop and mobile, light and dark themes, generation panel, comparison state, cold-start state, and Konling dock.
- [ ] 4.2 Run a browser-capable visual subagent review comparing implementation screenshots to `design-handoff.md`, `01-path-generation-main.png`, `02-path-selection-comparison.png`, and `03-active-path-execution.png`.
- [ ] 4.3 Fail the change if the reviewer returns any unresolved visual BLOCK.
- [ ] 4.4 Add tests or visual text checks proving forbidden strings are absent from student-visible UI.
- [ ] 4.5 Add visual evidence that desktop content uses a fluid workspace region instead of a centered fixed-width page, while mobile reflows into task-first panels rather than a squeezed desktop table.
- [ ] 4.6 Run `rtk openspec validate redesign-adaptive-path-generation-selection-ui --strict`.

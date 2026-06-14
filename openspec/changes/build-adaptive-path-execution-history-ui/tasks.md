## 1. Active Path Execution

- [ ] 1.1 Render `当前学习路径` with full path map and explicit `当前节点` marker.
- [ ] 1.2 Show elapsed time, estimated remaining time, estimated total time, completed nodes, checkpoint pass state, and weekly learning.
- [ ] 1.3 Render node detail with title, recommendation reason, launch action, estimated time, evidence to collect, and checkpoint criteria.
- [ ] 1.4 Preserve path context when launching interactive lessons, quizzes, control workbench, simulations, Arena, external resources, reflection, or Konling support.

## 2. Node Actions

- [ ] 2.1 Add completed-node actions `回顾`, `继续互动`, and `查看证据`.
- [ ] 2.2 Ensure continued interaction on a completed node writes new evidence without double-counting first completion.
- [ ] 2.3 Add unfinished-node actions `开始学习` and `跳过`.
- [ ] 2.4 Before skip, show the exact consequence warning from the accepted handoff and record skip as path deviation.

## 3. History And Evidence

- [ ] 3.1 Render `学习路径记录` or `路径完成与证据` with completed nodes, elapsed time, time delta, checkpoint pass rate, review count, and new evidence.
- [ ] 3.2 Render a timeline for completion, continued interaction, retry, skip, checkpoint pass/fail, Konling intervention, and external-resource reference.
- [ ] 3.3 Use evidence source labels for interactive course, adaptive quiz, control workbench, simulation, Arena, external resource, and Konling.
- [ ] 3.4 Use only student-facing evidence states: `已记录`, `待复核`, `可用于推荐`, and `仅作参考`.

## 4. Visual And Data Governance Gates

- [ ] 4.1 Capture browser evidence for active path, selected node, completed-node review, skip warning, history timeline, and mobile states.
- [ ] 4.2 Run a browser-capable visual subagent review comparing implementation screenshots to `03-active-path-execution.png`, `04-history-evidence-record.png`, and the handoff.
- [ ] 4.3 Add tests proving skip, return, review, continue, checkpoint, and Konling intervention events enter governed path activity.
- [ ] 4.4 Add tests proving completed-node continued interaction does not double-count first completion.
- [ ] 4.5 Run `rtk openspec validate build-adaptive-path-execution-history-ui --strict`.

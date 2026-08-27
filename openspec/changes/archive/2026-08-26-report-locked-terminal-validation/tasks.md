## 1. 报告层

- [x] 1.1 当终点已纳入但没有任何 ready 节点时，更新 `terminalValidationStrategy.summary`。
- [x] 1.2 在 `paths[].limitations` 加入稳定文案“终点已纳入但当前不可验证”。
- [x] 1.3 ready Arena 对照保持现有 summary 与 limitations。

## 2. 验证

- [x] 2.1 覆盖 cold-start / `NO_EVIDENCE` 下 locked 终点报告，以及 ready Arena 对照。
- [x] 2.2 运行相关 Planner 测试与 `openspec validate`。

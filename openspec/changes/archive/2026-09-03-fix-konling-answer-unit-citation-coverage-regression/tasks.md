## 1. 覆盖契约与分类规则

- [x] 1.1 为 `scanKonlingAnswerUnits` 增加 substantive 判定（引导头、短过渡、纯数学展示行、分隔线排除；`KonlingAnswerUnitRecord.substantive` 字段），requiredUnits 只取 substantive 行。
- [x] 1.2 实现未绑定需证据单元的缺失原因分类（`no-marker` / `marker-unassigned` / `citation-unverified` / `citation-no-target`）并附加到 `answerUnitCoverage.missingReasons`。
- [x] 1.3 实现引用漂移与重复堆叠的 guard 诊断计数，确认重复不虚增单元覆盖。

## 2. Prompt 供给与回归测试

- [x] 2.1 `ai-prompt-builder.ts` 可绑定编号全量暴露（保持 verified + citationTargetId 过滤），追加编号复用与无证据缺口说明。
- [x] 2.2 六个 study-question 意图的冻结回归：substantive 分类、覆盖率计算、缺失原因归类。
- [x] 2.3 重复堆叠、跨段漂移、`marker-unassigned` / `citation-unverified` / `citation-no-target` 的触发用例；全结论引用输出 ratio = 1。
- [x] 2.4 prompt 契约测试更新（编号全量 + 复用/缺口说明）。

## 3. 验证与交付

- [x] 3.1 运行 konling 相关 vitest 套件与既有 #1819 覆盖测试，确认 invalid strip、低置信降级、normative fail-closed 无回归。
- [ ] 3.2 `npm run typecheck`、strict change validate、`git diff --check`。
- [ ] 3.3 PR 验证记录：分类规则、覆盖计算口径、真实模型 85% 门槛待主实验复测的边界如实标注。

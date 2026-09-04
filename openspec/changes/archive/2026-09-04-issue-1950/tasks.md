## 1. 口径与装饰归一化

- [x] 1.1 `src/lib/konling-study-question-structure.ts`：`STUDY_QUESTION_SCORING_CALIBERS` 注册 `structure-alias.v2`；实现确定性前导装饰剥离（emoji 块含 VS16/ZWJ/keycap、编号 token、装饰标点块、空白），v2 口径在既有归一化前应用；`evaluateStudyQuestionStructure` 与 `detectStudyQuestionSectionHeading` 增加可选 `caliber` 参数，默认 v2，v1 与 strict-title.v0 行为冻结。
- [x] 1.2 单元测试（structure contract 测试文件）：Issue 四个装饰标题命中 code-debugging 全部章节；编号（`1.`、`（二）`、`一、`）与装饰标点前缀命中；负例——剥离后为空、语义不符标题、只在正文提及关键词仍失败；`2023 规范结论` 等数字开头真实标题不被误剥；v1 冻结回归（装饰标题在 v1 下仍失败）；无装饰输入 v1/v2 输出恒等。

## 2. 入口与产品路径切 v2

- [x] 2.1 `scripts/konling-fair-experiment/replay-scoring.ts` 默认口径串改为 `structure-alias.v1,structure-alias.v2`；`run-fixture.ts`、`run-live.ts` 主口径切 `structure-alias.v2`。
- [x] 2.2 更新 `konling-fair-experiment-entrypoints-smoke-1947.test.ts` 与 `konling-fair-experiment-1900.test.ts` 中默认口径断言（默认=v2 显式一致；fixture 无装饰标题端到端结果不变）。

## 3. 固定回放差值

- [x] 3.1 以 Issue 所列四标题形态构造两条 code-debugging 冻结回答（正文非空、盲审通过形态），在测试运行目录上经 `replayKonlingFairExperimentScoring` 以 `[structure-alias.v1, structure-alias.v2]` 回放：断言 v1 fail、v2 pass、`caliberDeltas` 含 `caliber:structure-alias.v1->structure-alias.v2`，且回放不触发生成、不修改回答文件。

## 4. 验证与交付

- [ ] 4.1 `rtk npm run typecheck`、相关 Vitest 文件与 `test:unit` 中 konling 域套件通过；openspec strict validate 通过后按流程 archive 与 PR 交付。

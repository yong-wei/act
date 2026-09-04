## Why

2026-09-04 公平实验（fair-live-20260904-r1，Issue #1951）汇总输出了结构通过率、匿名盲审、综合通过率与意图一致率，但没有引用精确率与答案单元追溯覆盖率，无法回答"本次实验追溯覆盖率是多少"；上一轮实验（#1902）的答案单元覆盖口径未被三臂实验继承，版本间无法可靠比较。盲审模型对"引用规范"的称赞不能替代确定性计算——两指标必须以可核验 citation identity 为输入。

当前缺口：公平实验回答快照只冻结纯文本（`types.ts` 的 answer record 无 citation 列表），"成功核验"在实验管线中无真值来源；`buildPairedDifference` 只接受 boolean[]，比率型指标无配对 CI；汇总无 PPT/CSV/工作簿导出。

## What Changes

- **引用真值落盘**：生成阶段为每条回答持久化 citation 快照（`id`/`citationTargetId`/`verified`/`displayNumber`/`sourceType`）；`generateProvider` 契约扩展为可返回 `{ text, citations }`，旧 `string` 返回值保持兼容（视为无 citations）。快照与回答快照同目录冻结、first-writer-wins。
- **确定性 citation 审计**：新增纯函数模块（`konling-fair-experiment/citation-audit.ts`），复用 #1902 已冻结的答案单元扫描语义（导出 `scanKonlingAnswerUnits` 等助手，不复制实现），对每条冻结回答输出：已呈现引用数、已核验且直接支撑引用数、应引用单元数、已覆盖单元数，以及四类失败分桶（真实已核验 / 标记未分配 / 引用未核验 / 引用无锚点）；`model-derived` 章节不入追溯分母，占位符与不可访问目标不计为覆盖。
- **汇总扩展**：`aggregateKonlingFairExperiment` 组装按回答、意图与实验组的引用精确率与追溯覆盖率，per-answer 审计记录入 official 汇总；三臂绝对值、配对百分点差与 95% 置信区间（新增比率型配对 bootstrap，确定性种子机制与现有一致）。citation 快照缺失或审计不完整时 fail closed（`incomplete` phase 扩为含 `citation-audit`），不写 official。
- **同源导出**：`summary/official.json` 保持单一冻结真源（exists-refuse 不变）；新增从真源派生的 CSV（复用 `toCsv`）、xlsx 工作簿（复用 `write-excel-file`）与 markdown 幻灯片导出，写前校验真源 `complete` 与内容哈希一致。
- 单元划分与分母规则与各意图 citation policy（`STUDY_QUESTION_SECTIONS` 的 `evidence-required`）对齐并随 spec 冻结。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `konling-fair-baseline-replay-evaluation`: 三臂公平实验的正式汇总 SHALL 确定性产出引用精确率与答案单元追溯覆盖率，引用审计不完整时 fail closed，且全部导出载体同源于冻结真源。

## Impact

- `src/lib/konling-fair-experiment/types.ts`（answer record 扩展、phase 枚举、汇总类型）、`runner.ts`（citation 快照冻结）、`citation-audit.ts`（新）、`aggregate.ts`、`metrics.ts`（比率配对差）、`store.ts`（审计记录写出）、导出模块。
- `src/lib/konling-agent-runtime.ts`：仅导出既有内部助手（`scanKonlingAnswerUnits`、`isBindableAnswerUnitCitation` 等），不改其语义。
- `scripts/konling-fair-experiment/run-live.ts`（provider 返回 citations）、`run-fixture.ts`（fixture 带标记与未核验变体）。
- 测试：新增 1951 套件并扩展 1900 fixture。
- 显式非目标：不修改知识检索排序算法；不把 model-derived 章节计入追溯分母；不引入二进制 .pptx 生成依赖（PPT 载体以 markdown 幻灯片从真源派生，如需 .pptx 另立变更）；不回填重跑历史实验；不改盲审模型与口径。

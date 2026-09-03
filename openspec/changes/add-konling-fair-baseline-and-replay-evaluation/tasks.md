# Tasks

## 1. 共享运行目录内核

- [ ] 1.1 从 `src/lib/konling-blind-audit/store.ts` 抽出锁、原子写、运行目录准备与 manifest 漂移检查到共享内核模块（参数化 artifacts 子目录）。
- [ ] 1.2 盲审 store 改为复用共享内核，导出面与目录布局不变；`konling-blind-audit-resume-1820.test.ts` 全量通过。

## 2. 评分口径

- [ ] 2.1 `evaluateStudyQuestionStructure` 增加可选 `caliber` 参数（`structure-alias.v1` 默认 / `structure-strict-title.v0`），默认行为逐字节不变。
- [ ] 2.2 单元测试：同回答在别名口径通过、固定标题口径失败；默认参数与现行输出一致。

## 3. 实验库 `src/lib/konling-fair-experiment/`

- [ ] 3.1 types + 题库（派生自 `KONLING_BLIND_AUDIT_BENCHMARK_V1`，含哈希）与任务键。
- [ ] 3.2 三臂 prompt 组装：共用 `AIContext`；plain/enhanced 为纯文本行，full-feature 走 `buildKonlingTeachingAssistantRuntimeContract` + `buildKonlingSystemPrompt`；产品默认路径零改动。
- [ ] 3.3 store：answers/scores/failures/summary 布局，共享内核驱动，completed 冻结不覆盖。
- [ ] 3.4 评分与回放：按口径对快照确定性评分；replay 只读快照，不触发生成。
- [ ] 3.5 metrics：绝对值、百分点差、配对 bootstrap 95% CI（mulberry32，种子入 manifest）、方向；综合指标并列分项。
- [ ] 3.6 runner + aggregate：单一命令按生成→评分→（live）盲审→汇总推进；完整性门禁与混配置拒绝 fail closed。

## 4. 脚本与入口

- [ ] 4.1 `scripts/konling-fair-experiment/run-fixture.ts`：确定性端到端（含故障注入与断点续跑演示参数）。
- [ ] 4.2 `scripts/konling-fair-experiment/run-live.ts`：显式 opt-in 环境变量，真实模型与盲审 judge。
- [ ] 4.3 `scripts/konling-fair-experiment/replay-scoring.ts`：对既有快照按口径回放并输出 caliber-delta 报告。
- [ ] 4.4 package.json 增加三条 npm scripts；README 补充用法与 fail-closed 说明。

## 5. 测试与验证

- [ ] 5.1 vitest：fixture 端到端（生成冻结、续跑不重生成、失败显式化、缺键/混配置不产正式汇总、回放不触发生成、CI 确定性）。
- [ ] 5.2 vitest：三臂 prompt 差异合同（enhanced 与 full 输出预算/章节一致；plain 无合同；full 含逐单元引用映射）。
- [ ] 5.3 `rtk npm run typecheck` 零错误；相关 vitest 目标套件通过；`rtk openspec validate add-konling-fair-baseline-and-replay-evaluation --strict` 通过。

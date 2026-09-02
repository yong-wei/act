## Why

知识问答的引用与讲解质量评测（主实验、迁移实验与独立模型盲审）目前依赖一次性实验脚本：外部模型服务在长批次中途返回限流、超时或余额不足时，已完成审计无法恢复，全部结果只能丢弃，造成计算浪费并诱发人工拼接不完整样本的风险。#1820 的实验里 240 条盲审在约 170 条时因余额不足中断，没有任何可复用数据。

仓库已有学情诊断评测体系（`diagnosis-accuracy-regression-gates`：版本化基准、fixture/live 入口、run ID 与只增不改的产物布局），知识问答盲审缺少同等的可断点续跑与完整性闭合基建。

## What Changes

- 新建知识问答盲审评测能力：版本化评测清单、模型与评分配置、git 修订可追溯。
- 每条审计完成后立即原子落盘，记录唯一任务键；重复运行跳过已完成项，不重复调用外部服务。
- 失败项（限流、超时、余额不足、单条解析失败）保留错误元数据并可重试；重试不覆盖已冻结记录。
- 汇总阶段检查预期样本数：不完整批次标记 `incomplete`，正式指标默认 fail closed。
- 规则评分与独立盲审保持分离产物，禁止静默混合。
- 故障注入测试覆盖四类外部失败的恢复行为。

## Capabilities

### New Capabilities

- `konling-blind-audit-evaluation`: 可断点续跑、逐条原子持久化并按完整性门禁汇总的知识问答盲审评测。

### Modified Capabilities

<!-- None. -->

## Impact

- 新增 `src/lib/konling-blind-audit/`（配置、运行器、存储、汇总）与 `scripts/konling-blind-audit/` 入口。
- 产物写入 `artifacts/konling-blind-audit/<runId>/`，目录只增不改。
- 不改动 `diagnosis-benchmark`、`konling-agent-runtime` 或任何生产运行时路径。
- 不新增数据库表；评测资产只落文件系统。

## Non-Goals

- 不自动购买或充值外部模型服务，不在 CI 中执行 live 盲审。
- 不把模型盲审视为真人学科专家评审的替代品。
- 不迁移或补录 #1820 实验中已丢失的一次性脚本数据。
- 不在本 change 内完成 240 条真实盲审运行（基建就绪后由计划性运行完成）。

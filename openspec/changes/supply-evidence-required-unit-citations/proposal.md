## Why

2026-09-06 三臂公平实验（`origin/integration@b1d6fef7a5`，18 题 × 2 replicate × 3 臂）显示：#2017 的引用编号白名单把"错误引用静默通过"的防线补齐后，完整功能组的引用精确率提升到 88.2%（30/34），但答案单元追溯覆盖率只有 46.2%（42/91），22/36 条回答触发引用缺口降级；代码调试 40.0%、开放讲解 33.3%、规范内容 41.7%。

根因在生成前：仓库事实证实两条证据供给断点——

1. 正式链路没有"按 evidence-required 答案单元分配来源"的逻辑。`konling-answer` 检索 profile 全局 `maxItems: 4`、`maxPerCitationTarget: 1`（`src/lib/source-pack/retrieval-profiles.ts:120`），prompt 只渲染前 3 条内容引用与前 4 条证据引用（`src/lib/ai-prompt-builder.ts:417,420`）；来源清单是全局一份，与意图合同的 `evidence-required` 章节无对应关系。
2. 公平实验的 full-feature 臂根本不接入 citationContext：`buildKonlingFairExperimentRuntimeContext` 不含 citationContext 字段（`src/lib/konling-fair-experiment/prompts.ts:84-104`），live 入口 citations 固定为 `undefined`（`scripts/konling-fair-experiment/run-live.ts:127-137`），fixture 用 4 条静态引用预编排绑定。实验度量的是"后处理防线"，不是"生成前证据供给"。

后处理可以删除伪引用、标记待核验，但不能把缺失的证据变成可追溯的证据。

## What Changes

- 在生成前新增按意图合同的必需单元证据分配：解析 `STUDY_QUESTION_SECTIONS` 中 `citationPolicy === 'evidence-required'` 的章节，为每个必需章节从检索候选中分配至少一个可直接支撑的来源；允许同一来源支撑多个确实相关的单元，但逐单元做相关性判定，不做机械复制。
- 检索预算按必需单元分配：证据分配层按必需章节数放大检索候选（不改全局 profile 的生产默认），并保留 `maxPerCitationTarget` 等防重复约束。
- citation identity、displayNumber、targetId、定位信息与来源版本（`sourceRevision`）随生成上下文传入；prompt 从"全局引用清单"升级为"逐单元引用映射"，要求正文按单元绑定分配编号。
- 生成后沿用现有 scan/audit 口径（`scanKonlingAnswerUnits` + 直接支撑白名单）检查覆盖缺口；对缺失单元执行一次有界补证（换源重检索或重写绑定行）；仍无有效来源时保持 #2017 的 fail closed 语义（`[引用缺口：…]` 降级，不伪造引用）。
- 代码调试、开放讲解、规范内容三类重点意图分别输出覆盖失败原因（在现有 missReasons 分桶之上按意图分述导出）。
- 公平实验 full-feature 臂改用与正式链路同源的多来源证据装配函数构建 citationContext；冻结输入继续绑定 `gitRevision`；普通基线与增强提示基线不启用引用能力，0/0 指标继续显示 N/A（#2016 口径）。

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `konling-agent-runtime`: evidence-required 答案单元在生成前获得逐单元来源分配，citation identity 与来源版本随上下文传入，覆盖缺口有一次有界补证且失败保持 fail closed。
- `konling-fair-baseline-replay-evaluation`: full-feature 臂使用与正式链路一致的多来源证据装配，不再以单条冻结引用或静态编排代表完整证据供给。

## Impact

- `src/lib/ai-prompt-builder.ts`（逐单元引用映射渲染）、`src/lib/source-pack/retrieval-profiles.ts`（分配层预算）、新增按单元分配模块。
- `src/lib/konling-fair-experiment/prompts.ts`、`runner.ts`、`scripts/konling-fair-experiment/run-live.ts`、`run-fixture.ts`（证据装配同源化）。
- `src/lib/konling-fair-experiment/citation-audit.ts` / `aggregate.ts`（分意图失败原因导出）。
- 不更换模型供应商或盲审评分规则；不改变基线臂行为与生产路由；不把冻结题库结果表述为生产 RAG 检索准确率。

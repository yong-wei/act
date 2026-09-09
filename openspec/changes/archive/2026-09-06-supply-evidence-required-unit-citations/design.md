## Context

公平实验确定性审计（`src/lib/konling-fair-experiment/citation-audit.ts`）把覆盖率定义为「已绑定有效直接支撑引用的必需答案单元 / 应追溯答案单元」，直接支撑判据与生产 hybrid-retriever 的 relevance basis 白名单同源（`query-exact`/`query-lexical`/显式引用类，`semantic-score` 不算）。覆盖率 46.2% 不是审计口径问题，而是生成前供给问题：模型根本没有拿到按单元组织、可直接支撑的来源。

两条既有事实约束设计：

- `scanKonlingAnswerUnits` 的绑定语义是「单元行内 `[n]` 标记，verified 且有 citationTargetId」（`src/lib/konling-answer-unit-scan.ts:59-75,207`）；任何方案必须让模型在正确的行上标记正确的编号。
- #2017 执行器（`citation-whitelist-enforcement.ts`）已实现 fail closed：伪编号删除、缺口尾部 `[引用缺口：…]` 降级。本 change 不重做该层，只补足它之前的证据供给。

## Goals / Non-Goals

**Goals**

- 生成前：每个 evidence-required 章节至少绑定一个可直接支撑来源，并进入生成上下文。
- 生成后：用现有口径度量覆盖缺口，一轮有界补证，失败保持诚实降级。
- 公平实验与正式链路同源装配证据，实验结论可外推到生产改进。

**Non-Goals**

- 不更换模型供应商、检索引擎或盲审评分规则。
- 不做主张级蕴含验证（语义判定超出确定性审计范围，沿用 #1992 review 结论）。
- 不改动基线臂与生产默认检索 profile 的全局行为。

## Decisions

### D1. 按单元分配是确定性模块，不新增模型调用

新增分配层（暂名 `buildEvidenceRequiredUnitSourcePlan`）：输入意图合同（`STUDY_QUESTION_SECTIONS[intent]` 的 evidence-required 章节）+ 检索候选池（hybrid-retriever `eligibleItems` + 教材检索候选），输出「章节 → 有序来源分配表」。选择逻辑只用既有确定性信号（relevance basis 白名单、查询词命中、`maxPerCitationTarget` 去重、章节标题与候选标题/关键词匹配）。不做模型驱动的分配，保证可回归、可审计。

### D2. 检索预算按必需单元放大，封装在分配层

`konling-answer` profile 的全局 `maxItems: 4` 不动（生产默认不变）。分配层在生成 evidence-required 答案时按 `必需章节数 × 每章节候选数` 计算请求预算并传入检索（`topK` 上限对齐教材适配层既有下限语义），候选仍过 `gateKonlingAnswerRelevance`。超出分配需求的候选不进入 prompt。

### D3. 上下文传递复用结构化身份，prompt 升级为逐单元映射

分配表中的每个来源渲染为 `KonlingAssignedCitation`（含 `KonlingCitationIdentity`、`displayNumber`、`canonicalKey`、`sourceRevision`），由 `assignKonlingCitationDisplayNumbers` 统一编号。`ai-prompt-builder` 中既有的 citationPolicy 指令行（`ai-prompt-builder.ts:492-503`）升级为逐单元映射行：「<章节标题> → 使用编号 [n]（或 [n]/[m]）」，并保留「同一编号可在多个不同结论单元重复使用」规则（一源多单元合法，但映射必须逐单元显式给出）。

### D4. 生成后一轮有界补证，失败保持 fail closed

生成后用现有口径检查（`scanKonlingAnswerUnits` + `isDirectVerifiedSupportCitation`）。存在缺失必需单元时执行一轮补证：优先换源（用分配表中的备用来源重渲染该单元映射行并请求重写该绑定行），重写仍无有效来源则维持 #2017 降级（`enforceAnswerUnitCitationCoverage` 追加 `[引用缺口：…]`）。补证至多一轮、不循环；补证轮次与结果写入引用快照供审计归因。

### D5. 公平实验证据装配与生产同源

`buildKonlingFairExperimentRuntimeContext` 增加 citationContext 字段，由 D1 的分配层（同一函数、同一白名单判据）在 full-feature 臂生成前装配；live 入口透传该上下文并在回答记录冻结 citations 快照（不再 `undefined`）；fixture 从静态 4 条预编排改为调用同一装配函数的多来源分配。冻结绑定不变：`gitRevision` 随记录落盘、manifest 载荷哈希、mixed-configuration 拒绝，全部沿用既有机制。

### D6. 分意图失败原因导出

审计层已有 missReasons 分桶（`no-marker → marker-unassigned → citation-unverified → citation-no-target`）与 byIntent 聚合。补一层按意图 × 失败原因的显式导出（official summary 增列），代码调试、开放讲解、规范内容三类的失败不再被总体平均掩盖。

## Risks / Trade-offs

- 「覆盖率 ≥85%、分意图 ≥70%」是实验结果门槛，不由实现保证：提案交付的是供给与补证机制 + 回归测试；门槛达标与否以重跑三臂实验为准，不达标时按数据归因（供给不足 vs 补证失败 vs 意图难度），不通过放宽口径达标。
- prompt 逐单元映射增加指令长度：六意图合同各 2-3 个 evidence-required 章节，映射行可控；对基线臂零影响。
- 一源多单元与「机械复制引用」的边界：以逐单元相关性判定为准（分配层对每个单元独立判定来源相关性），同一来源重复出现必须能在审计侧通过 `answerRelevanceBasis` 逐绑定核验。

## Migration Plan

1. 落地分配层 + prompt 映射（生产 full-feature 路径灰度于 fair-experiment 链路先行）。
2. 公平实验装配同源化 + 回归测试（多单元/多来源、单源多单元、检索无结果、补证失败、来源版本漂移）。
3. 重跑三臂实验，按验收门槛读取总体与分意图指标；不达标回到数据归因。

## Open Questions

- 检索候选按章节匹配时的标题/关键词匹配权重是否需要意图差异化（代码调试偏 API/符号名，规范内容偏条款号）——实现期以最小可行匹配起步，实验数据不足时再分化。

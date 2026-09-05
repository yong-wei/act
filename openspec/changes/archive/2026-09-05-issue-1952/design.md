## Context

公平基线实验链路（#1900/#1947）现有形态：

- 题库 `KONLING_FAIR_EXPERIMENT_BANK_V1` 派生自 #1820 盲审基准：六意图各 1 题、2 重复，条目仅 `itemId/intent/question/referenceAnswer`；参考答案单句。
- 盲审 judge：`konling-blind-audit.v1` prompt + `rubric.v1`，输出 `verdict: pass|needs-improvement|fail` + `ruleScore 0-1`；`parseKonlingFairExperimentJudgeVerdict` 对非法语义 fail closed。
- 官方摘要：perArm（structure@caliber、audit、composite、classificationAgreement）、generationDeltas（三臂配对差值 + 确定性 bootstrap CI）、caliberDeltas。
- 回放、fail-closed 聚合、manifest 冻结、命名空间隔离（`scores/<caliber>/<scorerRevision>/<arm>/`）均已就绪（#1950 刚将口径升级为 structure-alias.v2 家族）。
- 实验结论与 Issue #1949（引用核验门禁）同系列但独立：本变更只动评测侧，不动产品回答链路。

## Goals / Non-Goals

**Goals:**

- 题库具备难度（基础/综合/对抗）、知识点与风险类型分层，能区分不同能力层次的表现。
- 盲审能区分完全正确、轻微缺陷、重大错误三级，并分维报告准确性/证据忠实度/教学有效性/结构合规/追溯覆盖率。
- 天花板/地板效应可见；分层配对差值可归因。
- 教师双人独立复核子集可校准自动盲审，一致性与分歧显式报告。
- 合成实验表述边界固化在报告 schema。

**Non-Goals:**

- 不调产品提示词；不加重复次数；不做复核录入 UI；不实现真实学生实验。
- 不引入多评审模型集成（单 judge 模型 + 分级量表 + 专家校准子集已满足判别力验收）。
- 不改三臂 prompt 公平合同与生成侧任何行为。

## Decisions

**D1：题库以独立 V2 常量交付，不改写 V1。**
V1 已被 fair-live-20260904-r1 以其哈希冻结引用；同结构追加版本是 #1820 基准的既有约定。`KonlingFairExperimentBankItem` 增加可选 `difficulty`/`topic`/`riskType`（V1 条目缺省为 `undefined`，哈希函数把可选字段纳入 canonical JSON——undefined 字段 JSON.stringify 丢弃，V1 哈希不变；V2 哈希含分层标注）。

**D2：难度三档 × 六意图 = 18 条，对抗条目风险类型全覆盖六种。**
每意图固定 3 条（基础/综合/对抗各 1），知识点在意图内互不重复（如 formula-derivation 覆盖闭环传函推导/稳态误差计算/离散化条件）。六种风险类型（错误前提、证据冲突、规范时效、代码隐蔽缺陷、边界条件、信息不足）在 6 条对抗题中各出现一次（按意图特性配对：代码隐蔽缺陷固定给 code-debugging、规范时效给 normative-content，其余四种分配给另四个意图）。参考答案多要点；对抗题参考答案必须示范正确处置（指出前提错误/说明证据冲突与取舍/声明时效核验要求/点出隐蔽缺陷根因/给出边界外行为/列出缺失信息与合理假设）。

**D3：graded judge 以新解析器与新 prompt 版本交付，旧解析器不动。**
`parseKonlingFairExperimentGradedVerdict`：`verdict ∈ {correct, minor-flaw, major-error}`，五子分 `accuracy/evidenceFaithfulness/pedagogy/structureCompliance/traceCoverage` 各 0-1 有限数值，`notes` 可空；任何非法值 → null → parse-failure（沿用 #1900 fail-closed 语义）。`auditProvider` 结果类型扩展为携带五子分；fair-experiment `audit` 配置的 `promptVersion`/`scoreVersion` 记 `konling-blind-audit-graded.v2`/`rubric-graded.v2` 进 manifest。旧 V1 路径（`--bank v1`）继续用冻结的 v1 judge。

**D4：报告判别力扩展在 aggregate 层实现，分层维度来自题库标注。**
官方摘要新增：
- `auditDimensions`：per arm × 五子分均值 + `verdictDistribution`（correct/minor-flaw/major-error 计数）。
- `ceilingFloor`：per arm 的 ruleScore ≥0.95 与 ≤0.05 比例（rubric.v1 兼容：graded 记录同样保留 ruleScore 总分）。
- `stratified`：`难度 × 意图` 的 structure 通过率与五子分均值；分层配对差值复用 `buildPairedDifference`（seedParts 含层标识，确定性保持）。
- `expertReview`：确定性抽样清单（每意图 1 条，种子派生自 config.sampling.seed）+ 若运行目录存在 `expert-review/records.json` 则报告双人一致率（一致判定 proportion over 分级 verdict）与分歧条目清单（含双方判定，标记 `resolution: 'pending-teacher'`）；文件缺失时 `status: 'pending'`。
- `syntheticDisclaimer` 固定字符串字段。

**D5：run 入口以 `--bank` 参数切换，默认 V2。**
run-live/run-fixture 增 `--bank v1|v2`；v2 组装 graded 系统提示词与解析；v1 保持现行为。fixture 的确定性 provider 按 bank 条目分层标注生成可预期差异的回答（对抗题 plain 臂易触发重大错误样例，给聚合提供非退化分布）——仅 fixture 演示用，不影响 live。

**备选（拒绝）：** 直接改 V1 条目——破坏已冻结实验的可追溯性；多 judge 集成投票——成本与判别力收益不成比例，专家复核子集已提供人工校准锚点。

## Risks / Trade-offs

- [分级 judge 的子分主观性] → 五子分各配一句操作性定义进 prompt；专家复核子集用于校准；子分只做描述性报告，不进合成排名结论。
- [18 题内容质量] → 参考答案由领域知识撰写并显式处置风险；题库哈希冻结后修改需升版本；分层契约测试锁定覆盖矩阵。
- [专家复核数据缺失] → 聚合显式报告 pending，不阻塞正式摘要；分歧不自动裁决。
- [分层配对差值的小样本噪声] → 层内条目 2 重复 × 3 臂 = 6 观测/层，CI 宽属预期，报告注明层样本量；天花板/地板比例提供整体判别力健康度。

## Context

编排器先用 `micro-tutoring-validation-registry-v2.json` 解析独立验证题，再查询 `AdaptiveAssessmentItemRef`：`questionId` 必须命中 canonical / runtime 两种 ID，且 `contentHash` 与投影一致，catalog 快照还要通过当前权威 `mastery` 检查。现有同步只写 TeachingResource；`AdaptiveAssessmentItemRef` 只在选题/作答时以空 `update` 幂等创建，且不写 `remediationValidation`。干净库因此投影有候选、数据库为 0。资格投影只读静态注册表，所以入口仍显示。See proposal.md for motivation.

v1 注册表保持只读。题目身份以 registry `sourceId` 为准，查询侧已覆盖 `checkpoint-authored-question:` runtime 前缀。

## Goals / Non-Goals

**Goals:**

- 把当前 v2 验证注册表的启用条目幂等物化到 `AdaptiveAssessmentItemRef`，使真实编排查询能找到它们。
- 绑定同一 Git 捕获修订；本地、测试和生产使用同一同步逻辑，并并入现有微辅导同步入口。
- 保持编排 fail-closed；为学生可见复现题消除 `VALIDATION_QUESTION_UNAVAILABLE`。

**Non-Goals:**

- 不放宽 `remediation-orchestration` 查询，不按关键词回退邻近验证题。
- 不改选项归因、v1 注册表、资源投影或 TeachingResource 物化合同。
- 不把 `AdaptiveAssessmentItemRef` 改成可变目录真源，不改写历史答题快照的主键或内容哈希。
- 不签发新的生产资格，不激活生产选择器，不改 OSS/ESA。

## Decisions

1. **以 registry `sourceId` + 内容哈希为物化身份，不以作答事件为生产者。**  
   编排查询 `questionId IN microTutoringValidationQuestionIds(sourceId)` 且要求 `row.contentHash === projected.contentHash`。预先作答只会留下偶然、缺治理元数据的快照，不能作为正式路径。替代方案（放宽为只读投影）会破坏现有 fail-closed 合同。

2. **catalog 快照必须能通过当前权威 `mastery` 检查。**  
   `parseValidationItem` 把 `metadata.adaptiveAssessmentItemRef` 与 `findAdaptiveAssessmentCatalogSnapshot(questionId)` 对照。物化 MUST 写入完整 catalog 快照形状（含 `sourceLineage`、`reviewDecision`、`relationship`、`questionRefs`），内容哈希必须等于注册表与当前 catalog。catalog 缺失或哈希/版本漂移 fail-closed。

3. **`remediationValidation` 只在创建路径写入；一致的既有行不覆盖。**  
   唯一键是 `(questionId, algorithmVersion, contentHash)`。既有答题快照若身份与哈希一致且未被标为 `learnerVisible=false`，视为 unchanged，不得改主键或内容哈希。唯一键冲突但治理/版本不一致时 fail-closed，不得用同步去“修好”历史快照。缺失行才 create，并写入 `learnerVisible`、`itemRevision`、`estimatedMinutes`、`actionPath` 和捕获修订。

4. **并入现有 CLI，计划层可单测。**  
   规划函数纯函数化，CLI 在 TeachingResource 计划成功后再应用验证题计划；任一失败则整体失败，避免半完成状态。脏 Git 与 TeachingResource 同步相同：不得把投影当成干净修订写入。

5. **学生文案只映射编排原因，不改资格投影枚举。**  
   资格层 `VALIDATION_UNAVAILABLE` 表示静态投影为空；本缺口是编排层 `VALIDATION_QUESTION_UNAVAILABLE`。面板对后者给出明确中文，避免与“没有可安全执行的任务”混淆。

## Risks / Trade-offs

- [同一 `questionId` 已有不同 contentHash 的历史答题快照] → 保留历史行，另建投影哈希行；查询按哈希过滤。
- [既有行缺 `remediationValidation` 但哈希一致] → 视为 unchanged，因为 `parseValidationItem` 在 `learnerVisible` 非 false 且 catalog mastery 成立时仍可通过；避免改写不可变答题快照。
- [生产库尚未跑同步] → 代码合入不等于生产已修复；生产只走既有发布/迁移门禁套用同一 CLI。
- [资格入口仍可能先亮起] → 本变更不改资格投影；物化后编排成功，入口与任务一致。

## Migration Plan

1. 在干净 Git HEAD 上对目标库运行同一幂等同步 CLI。
2. 用复现题与 54 道 practice 已审核错误选项复核编排查询。
3. 回滚：停止运行同步；已写入的验证题快照可按捕获修订审计，不自动删除，以免误伤历史作答引用。

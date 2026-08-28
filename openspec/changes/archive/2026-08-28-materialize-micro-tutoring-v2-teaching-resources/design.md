## Context

编排器先用 `micro-tutoring-resource-projection-v2.json` 解析 `registryId`，再查询 `TeachingResource`：`teacherOnly=false` 且（`knowledgeNodes` 含当前 `kn:` 节点，或 `config.remediation.prerequisiteKnowledgeNodeIds` 含该节点）。命中后再经 `parseResource`：`config.remediation.misconceptionTags` 与 `prerequisiteKnowledgeNodeIds` 必须是数组，并且规范节点匹配 prerequisite 或 ResourceNode `knowledgeCoverage`。#1521 只写了静态投影；当前 9 组资源要么缺行，要么 `knowledgeNodes=[]` 且 `config={}`，因此在身份匹配前就被过滤。

v1 投影保持只读。规范节点 ID 是 `kn:autocontrol:*`，与注册表旧图谱节点 ID 不同，不能复用 `repair-resource-identity-bindings.ts`。

## Goals / Non-Goals

**Goals:**

- 把当前 v2 投影的 9 组资源幂等物化到 `TeachingResource`，使真实编排查询能找到它们。
- 绑定同一 Git 捕获修订；本地、测试和生产使用同一同步逻辑。
- 保持编排 fail-closed；为学生可见复现题解析到 `lesson11-graphical-thinking-workshop`。

**Non-Goals:**

- 不放宽 `remediation-orchestration` 查询，不按关键词回退邻近资源。
- 不新建 `kn:` KnowledgeNode 图节点，不改题目归因或验证题注册表。
- 不改 v1 投影/资格回执，不签发新的生产资格，不激活生产选择器，不改 OSS/ESA。

## Decisions

1. **以 `config.remediation` 为运行时绑定，不以新图谱节点为绑定。**  
   `parseResource` 要求 remediation 数组存在；JSON 路径也是 `findMany` 的合法条件。新建 `kn:autocontrol:*` KnowledgeNode 会污染教学图谱。若库中已有该 ID 的节点，同步 MAY 补关系，但不得为了关系而创建节点。

2. **按 `registryId` 定位，创建时 `id=registryId`。**  
   与 `seed-interactive-resources.ts` 一致，才能对上已有 path-readiness 批次 `teaching-resource:<registryId>`。同一 `registryId` 多行视为身份漂移并 fail-closed。不得改已有行的主键。

3. **合并 `config.remediation`，并叠加已审核 registry 的 path-planning。**  
   并入投影的 `knowledgeNodeId` 与全部 `misconceptionTag`，写入 revision 与捕获修订。编排器只消费 `teaching_resource` 节点，且 `parseResource` 要求 1–10 分钟和 path-plannable。9 个 `registryId` 已在核心 path-readiness 批次中以 `registry:` 身份审核；同步把该审核投影到 TeachingResource 的 `resourceNodePlanning`（`estimatedTimeMinutes` 用投影的 6 分钟、`knowledgeCoverage` 含 `kn:` 节点），不得为未审核 registry 伪造 human-confirmed。`teacherOnly=true` 视为授权撤销，不得强行改为学生可见。

4. **不修改编排器 fail-closed。**  
   同步负责让合格行通过现有查询与 `parseResource`。测试必须模拟真实 `findMany` 条件，而不是忽略 `where`。

5. **工作区不洁净时严格写入 fail-closed。**  
   捕获修订取当前 Git HEAD；脏工作区不得把投影当成干净修订写入数据库证明。测试可注入固定 revision。

## Risks / Trade-offs

- [已有行主键是 cuid] → 仍按 `registryId` 更新 config，不改 id；ResourceNode `sourceRef` 用实际 id，path readiness 可能对不上。若 `parseResource` 仍因 disposition 失败，同步 MUST 报告失败而不得伪造 human-confirmed 审核。
- [生产库尚未跑同步] → 代码合入不等于生产已修复；生产只走既有发布/迁移门禁套用同一 CLI。
- [272 项审计已能靠静态投影归零] → 本变更以「带 TeachingResource 权威行的编排/审计路径」为验收，不把 parent #1519 生产资格写成已完成。

## Migration Plan

1. 在干净 Git HEAD 上对目标库运行同一幂等同步 CLI。
2. 用复现题与 9 组权威行复核编排查询。
3. 回滚：停止运行同步；已写入的 remediation 键可按捕获修订审计，不自动删除 TeachingResource 行，以免误伤教案引用。

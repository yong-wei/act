# 隐藏控灵内部运行时上下文 Receipt

基线：`2f495a1971`（claim branch 建立点）。

## 1. 消费者盘点（task 1.1）

`/api/ai/konling-context` 的调用者扫描：唯一调用者是自身的路由测试
（`src/lib/data-governance/__tests__/konling-context-route.test.ts`）。其余命中
（simulation-shell、knowledge-graph-system、adaptive-learning-center-contracts、
konling-teaching-assistant-server-context、learner-state-reducer 测试）均为
data-* 属性、字符串常量或文件路径清单，不是 API 消费者。**生产前端零消费者**，
task 2.1 废弃路线生效；无学生 UI 字段需要保留公开投影。

## 2. 变更（task 2.1 / 2.3）

- 删除 `src/app/api/ai/konling-context/route.ts`：学生可读的完整运行时 DTO
  （学习画像、计划、知识工作区、教学投影、双域 provenance、私有 scoped_memory、
  permitted_tools、missing_context）不再存在于任何生产端点。
- 删除其路由测试（408 行）；该测试覆盖的授权边界（teacher scope、401/403/404）
  随端点一并退役，服务端构建器边界由 runtime 既有 208 项测试与新增边界回归覆盖。
- `learner-state-reducer.test.ts` 的 productionCallers 清单移除已删 route 路径。

## 3. 边界回归（task 1.2 / 3.1 / 3.2）

新增 `src/lib/__tests__/konling-context-boundary.test.ts`：

- **不可达性**：`src/app/api/ai/konling-context` 目录不存在；生产源码
  （runtime/global sidebar/knowledge system）不得再请求该 URL（防回潮）。
- **服务端可用性（canary）**：`buildKonlingRuntimeContext` 以注入 CANARY 值的
  knowledge node 构建运行时，断言 canary 存在于服务端返回结构（模型 grounding
  仍可消费治理上下文）且构建器保持服务端模块（无 `'use client'`）。

## 4. 验证（task 3.3）

- vitest：boundary 2 + learner-state-reducer + konling-agent-runtime 216 通过。
- `rtk npm run typecheck` exit 0；`rtk git diff --check` 干净。
- 未改服务端模型 grounding、私有记忆保留、learner-state 计算或正式记录。


## 5. Codex P1 修复（残留路由源断言）

`adopt-teaching-projection-in-konling-and-rag.test.ts` 与 `ai-domain-orchestration-boundaries.test.ts` 仍读取已删 route 源（ENOENT）：
- 前者：`teaching_projection_context`/`dual_domain_provenance` 存在性断言迁至 runtime 源（服务端构建器 `buildKonlingDualDomainProvenanceMetadataPayload`/`teachingProjectionContext`）。
- 后者：R3 越权门用例对象为已退役端点，随端点删除（等价授权门仍由 adaptive learner-state 等服务端入口承担）。
两文件 20 项测试通过；typecheck exit 0。

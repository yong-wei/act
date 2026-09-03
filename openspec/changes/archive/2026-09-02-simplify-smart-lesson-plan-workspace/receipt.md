# C32 智能教案工作区化简 Receipt

基线：`cedcd7fdef`（claim branch 建立点）。

## 1. Characterization 与 owner map（task 1.1 / 1.2 / 1.3）

按 code-simplification 流程通读 workspace（1,027 行）、lib（workspace.ts 投影、task-input-schema、service）与 preparation editor 模型后确认的重复建模面：

| 重复面 | 原 owner（workspace 本地） | canonical owner |
| --- | --- | --- |
| job 状态集合（轮询/恢复/禁修订）×5 处字面量 | 组件内散落 | `SMART_JOB_ACTIVE_STATES` / `SMART_JOB_RECOVERY_STATES` / `SMART_JOB_EDIT_BLOCKING_STATES`（lib workspace.ts） |
| 草稿/job/生成阶段中文标签 | `draftStateLabel` / `generationStateLabel` / `generationStageLabel` | `smartDraftStateLabel` / `smartGenerationStateLabel` / `smartGenerationStageLabel`（lib，文案逐字保留） |
| BOPPPS 阶段中文标签 | `bopppsStageLabel` 本地映射表 | preparation editor `BOPPPS_STAGES`（`Object.fromEntries` 查找） |
| PATCH 输入重建 | `taskUpdateInput(task)` | `buildSmartTaskUpdateInput`（lib task-update-input.ts） |
| 五阶段魔数 `=== 5` | `detailedActiveTask` 判断 | `SMART_PREPARATION_STAGE_ORDER.length` |

既有 characterization（保留并通过）：`smart-lesson-plan-workspace-contract.test.ts` 9 项（建议确认事件桥、advisory hydration 门、textbook-only 创建、superseded job 无恢复控件、courseware URL 合同、student projection server-owned）+ `generation-experience.test.ts` 轮询语义。新增 `workspace.test.ts` 6 项（阶段顺序/job 集合/标签逐字/输入重建含 REMOVED 与 RETIRED 过滤/缺省回填/组件防回潮断言）。

## 2. 化简执行（task 2.1–2.4）

- workspace 组件净 **−80 行**（1,027 → 947）：删除本地 label/集合/转换定义，改为 import lib 与 editor 的唯一事实。
- 事件桥（konling confirm/refresh、course-basis:changed）、2.5s 轮询、return-state 合同原样保留——无重复别名可删（`hasBlockingJob` 等剩余局部派生均为纯视图布尔，无第二事实源）。
- `SmartTaskUpdateSourceTask` 类型只声明 builder 实际消费的字段（不含 workspace 投影），与 `updateTaskSchema` 缺省语义一致。
- 行为保持：所有文案逐字迁移；两处 contract 源断言与一处 generation-experience 断言按新常量形态更新（语义不变）。

## 3. 验证（task 3.1–3.3 / 4.2）

- vitest：lib 12 文件 124 + workspace contract 9 + preparation editor contract，全部通过。
- `rtk npm run typecheck` exit 0；`rtk git diff --check` 干净；strict change validation 通过。
- 伪造/过期输入负向合同由既有 task-input-schema/service 测试覆盖（update schema 校验、expectedRevision 冲突），本变更未触碰。

## 4. Scope guard

未改 Prisma schema、API route 行为、AI provider runtime、生成队列/worker、发布链路或权限边界。


## 5. Codex 复审修复

- **P1（客户端依赖图污染）**：workspace 组件改从 `@/lib/smart-lesson-plan/workspace` 与 `task-update-input` 客户端安全子模块直接导入，不再经聚合 index（避免 queue/worker 的 BullMQ/Prisma/server-only 进入客户端图）；全仓 `use client` 文件经聚合入口导入扫描为零。
- **P2（过期响应防覆盖，task 3.1 补齐）**：新增 `taskRevisionOf`/`acceptFresherTask`/`mergeTasksByIdentity`——refreshTask、konling confirm 事件、course-basis 刷新、editTask/updateClassDiagnosis/updateSourceDecision 与列表查询全部改为 revision 单调合并，延迟旧响应不得回退界面 revision；补 2 项回归（源断言禁止无条件 `setTasks(payload.tasks)` / `? payload.task : task` 形态，及合并语义断言）。

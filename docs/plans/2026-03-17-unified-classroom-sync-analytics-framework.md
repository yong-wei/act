# Unified Classroom Sync & Analytics Framework Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 升级课堂数据模型，并把精品互动课程统一到一套“同步 + 埋点 + 结束课堂固化分析”的框架下，优先覆盖 `L-2d` 与 `L-sum`，同时为后续互动课程提供固定设计流程。

**Architecture:** 保留现有 `/api/session` 与 `/api/session/[sessionId]/state` 两条课堂主链路，在其上新增统一的课程同步 hook / adapter 层；同时升级 Prisma，把当前“单条快照 + 弱语义埋点”升级为“事件流 + 摘要快照 + 固化报告”三层数据结构。结束课堂与超时自动关闭统一走同一个 finalizer，先固化可追溯数据，再生成学生个人报告与教师班级报告，AI 总结作为可选增强，不阻塞课堂结束。

**Tech Stack:** Next.js 14、TypeScript、React、NextAuth、Prisma、PostgreSQL、Node 脚本测试、Playwright 集成测试。

### Task 1: 升级 Prisma 数据模型与课堂事件契约

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_unified_classroom_sync_analytics/migration.sql`
- Modify: `src/app/api/interactive/events/route.ts`
- Modify: `src/app/api/session/[sessionId]/state/route.ts`
- Create: `src/lib/classroom-analytics/types.ts`
- Test: `scripts/tests/test-unified-classroom-schema.ts`
- Test: `scripts/tests/test-classroom-event-api-contract.ts`

**Step 1: Write the failing tests**

Create `scripts/tests/test-unified-classroom-schema.ts`，断言：
- `StudentState` 新增 `stateKey`、`lessonKey`、`lastClientEventAt`
- `StudentState` 唯一键升级为 `@@unique([sessionId, userId, stateKey])`
- `InteractionLog` 新增 `lessonKey`、`stepId`、`actorRole`、`clientEventAt`、`resourceKey`
- `InteractionLog.resourceId` 改为可选，避免精品课程运行时资源 key 直接撞 FK
- 新增 `ClassSessionReport` 与 `StudentSessionReport`

Create `scripts/tests/test-classroom-event-api-contract.ts`，断言：
- `/api/interactive/events` 接收 `lessonKey/stepId/actorRole/clientEventAt/resourceKey`
- `/api/session/[sessionId]/state` 接收 `stateKey`
- `teacher:course-sync` 与学生课程状态不再共享同一个隐式唯一槽位

**Step 2: Run tests to verify they fail**

Run:
- `node scripts/tests/test-unified-classroom-schema.ts`
- `node scripts/tests/test-classroom-event-api-contract.ts`

Expected:
- 因 schema 与 API 契约尚未升级而 FAIL

**Step 3: Write minimal implementation**

最小实现包括：
- `StudentState`
  - 新增 `stateKey String @default("course")`
  - 新增 `lessonKey String?`
  - 新增 `lastClientEventAt DateTime?`
  - 唯一键改为 `@@unique([sessionId, userId, stateKey])`
- `InteractionLog`
  - `resourceId String?`
  - `resourceKey String`
  - `lessonKey String?`
  - `stepId String?`
  - `actorRole String?`
  - `clientEventAt DateTime?`
  - `attemptKey String?`
- 报告实体
  - `ClassSessionReport`：按 session 固化班级报告
  - `StudentSessionReport`：按 session + user 固化个人报告
- 事件与状态 API 同步升级
  - `/api/interactive/events` 写入新增字段
  - `/api/session/[sessionId]/state` 支持显式 `stateKey`

**Step 4: Run tests to verify they pass**

Run:
- `npx prisma validate`
- `node scripts/tests/test-unified-classroom-schema.ts`
- `node scripts/tests/test-classroom-event-api-contract.ts`

Expected: PASS

### Task 2: 落统一课堂同步框架（hook + adapter），不再在课程页复制轮询逻辑

**Files:**
- Create: `src/features/interactive/session-framework/session-contract.ts`
- Create: `src/features/interactive/session-framework/use-session-progress-channel.ts`
- Create: `src/features/interactive/session-framework/use-session-state-channel.ts`
- Create: `src/features/interactive/session-framework/use-student-lesson-session.ts`
- Create: `src/features/interactive/session-framework/use-teacher-lesson-session.ts`
- Create: `src/features/interactive/session-framework/index.ts`
- Modify: `src/app/api/session/[sessionId]/state/route.ts`
- Test: `scripts/tests/test-session-framework-contract.ts`

**Step 1: Write the failing test**

Create `scripts/tests/test-session-framework-contract.ts`，断言：
- 导出统一的 student / teacher session hooks
- hooks 暴露统一字段：`sessionInfo`、`stateRecords`、`activeIndex`、`teacherIndex`、`isOutOfSync`
- adapter 契约包含：
  - `lessonKey`
  - `studentStateKey`
  - `teacherStateKey`
  - `createEmptyStudentState`
  - `isStudentState`
  - `isTeacherSyncState`
  - `buildTeacherSyncPayload`
- 共享层内部统一处理 polling/bootstrap/error handling

**Step 2: Run test to verify it fails**

Run: `node scripts/tests/test-session-framework-contract.ts`

Expected: FAIL

**Step 3: Write minimal implementation**

最小实现：
- 把 `/api/session/[sessionId]` 的读/写与 optimistic rollback 封进 `use-session-progress-channel`
- 把 `/api/session/[sessionId]/state` 的 `teacher/student-view/self` 拉取与 `POST state` 封进 `use-session-state-channel`
- 页面通过 adapter 提供课程差异，不再自己写 `setInterval + fetch + parse`

**Step 4: Run test to verify it passes**

Run: `node scripts/tests/test-session-framework-contract.ts`

Expected: PASS

### Task 3: 落统一互动埋点与课堂事件收集框架

**Files:**
- Create: `src/features/interactive/session-framework/use-course-event-tracking.ts`
- Create: `src/features/interactive/session-framework/build-course-event.ts`
- Modify: `src/features/interactive/hooks/useInteractiveTracking.ts`
- Modify: `src/features/interactive/InteractiveProvider.tsx`
- Modify: `src/features/interactive/hooks/useInteractiveAI.ts`
- Create: `src/lib/classroom-analytics/event-taxonomy.ts`
- Test: `scripts/tests/test-course-event-tracking-contract.ts`

**Step 1: Write the failing test**

Create `scripts/tests/test-course-event-tracking-contract.ts`，断言：
- 统一事件最少覆盖：
  - `lesson_step_view`
  - `lesson_step_leave`
  - `lesson_submit`
  - `lesson_resubmit`
  - `workspace_param_change`
  - `ai_panel_open`
  - `ai_query_submit`
  - `sync_error`
  - `session_finalize`
- `useInteractiveTracking` 的本地缓存键包含 `resourceKey + sessionId + userId`
- `useInteractiveAI` 可接受事件回调，避免精品课程页内 AI 绕过埋点
- 统一事件 builder 会补齐 `sessionId/lessonKey/stepId/actorRole/resourceKey/clientEventAt`

**Step 2: Run test to verify it fails**

Run: `node scripts/tests/test-course-event-tracking-contract.ts`

Expected: FAIL

**Step 3: Write minimal implementation**

最小实现：
- 在 `src/features/interactive/session-framework` 新增课程页专用事件适配层
- 统一把步骤切换、作答、工作区变化、AI 交互与同步失败发到 `/api/interactive/events`
- 保留 `StudentState` 作为课程摘要快照，不再把它当成唯一分析来源

**Step 4: Run test to verify it passes**

Run: `node scripts/tests/test-course-event-tracking-contract.ts`

Expected: PASS

### Task 4: 迁移 `L-2d` 到统一框架，并接通细粒度埋点

**Files:**
- Modify: `src/features/interactive/l2d-three-domain-linkage/student-page.tsx`
- Modify: `src/features/interactive/l2d-three-domain-linkage/teacher-page.tsx`
- Modify: `src/features/interactive/l2d-three-domain-linkage/workspace.tsx`
- Modify: `src/features/interactive/l2d-three-domain-linkage/step-panels.tsx`
- Modify: `src/lib/l2d-course.ts`
- Test: `scripts/tests/test-l2d-session-framework-adoption.ts`
- Test: `scripts/tests/test-l2d-event-coverage.ts`

**Step 1: Write the failing tests**

Create:
- `scripts/tests/test-l2d-session-framework-adoption.ts`
- `scripts/tests/test-l2d-event-coverage.ts`

断言：
- `L-2d` 教师/学生页改用统一 session hooks
- `L-2d` 不再手写 `setInterval(() => { syncSession(); syncStates(); }, 5000)`
- 工作区参数变化、任务提交、反思提交、步骤浏览都进入统一事件流
- `student:l2d:state` 改为显式 `stateKey='course'`
- `teacher:course-sync` 改为显式 `stateKey='teacher-sync'`

**Step 2: Run tests to verify they fail**

Run:
- `node scripts/tests/test-l2d-session-framework-adoption.ts`
- `node scripts/tests/test-l2d-event-coverage.ts`

Expected: FAIL

**Step 3: Write minimal implementation**

最小实现：
- 用 adapter 描述 `L-2d` 的 student/teacher sync payload
- 工作区 `gain/metrics` 变化发 `workspace_param_change`
- 任务一/二/反思提交发 `lesson_submit`
- summary 页面展示从报告表读取的冻结结果；无冻结结果时退回本地摘要

**Step 4: Run tests to verify they pass**

Run:
- `node scripts/tests/test-l2d-session-framework-adoption.ts`
- `node scripts/tests/test-l2d-event-coverage.ts`

Expected: PASS

### Task 5: 迁移 `L-sum` 到统一框架，并接通细粒度埋点

**Files:**
- Modify: `src/features/interactive/lsum-design-feasible-domain/student-page.tsx`
- Modify: `src/features/interactive/lsum-design-feasible-domain/teacher-page.tsx`
- Modify: `src/features/interactive/lsum-design-feasible-domain/step-panels.tsx`
- Modify: `src/lib/lsum-course.ts`
- Test: `scripts/tests/test-lsum-session-framework-adoption.ts`
- Test: `scripts/tests/test-lsum-event-coverage.ts`

**Step 1: Write the failing tests**

Create:
- `scripts/tests/test-lsum-session-framework-adoption.ts`
- `scripts/tests/test-lsum-event-coverage.ts`

断言：
- `L-sum` 教师/学生页改用统一 session hooks
- `releasedActivities/revealedAnswers` 通过统一 adapter 输出 `teacher-sync`
- 步骤浏览、提交、重复修改、AI 助手交互进入统一事件流
- `student:lsum:state` 改为显式 `stateKey='course'`

**Step 2: Run tests to verify they fail**

Run:
- `node scripts/tests/test-lsum-session-framework-adoption.ts`
- `node scripts/tests/test-lsum-event-coverage.ts`

Expected: FAIL

**Step 3: Write minimal implementation**

最小实现：
- 用 adapter 描述 `L-sum` 的 released / revealed payload
- 文本题、选择题、summary 回收、页内 AI 统一发事件
- 教师汇总优先读取冻结报告，课堂进行中仍可回退到实时快照聚合

**Step 4: Run tests to verify they pass**

Run:
- `node scripts/tests/test-lsum-session-framework-adoption.ts`
- `node scripts/tests/test-lsum-event-coverage.ts`

Expected: PASS

### Task 6: 实现“结束课堂即固化分析”，并支持超时一天自动关闭

**Files:**
- Create: `src/lib/classroom-analytics/finalize-session.ts`
- Create: `src/lib/classroom-analytics/build-class-session-report.ts`
- Create: `src/lib/classroom-analytics/build-student-session-reports.ts`
- Create: `src/lib/classroom-analytics/generate-ai-session-summary.ts`
- Modify: `src/app/api/session/[sessionId]/route.ts`
- Create: `scripts/ops/close-stale-sessions.ts`
- Create: `scripts/tests/test-session-finalization.ts`
- Create: `scripts/tests/test-close-stale-sessions.ts`

**Step 1: Write the failing tests**

Create:
- `scripts/tests/test-session-finalization.ts`
- `scripts/tests/test-close-stale-sessions.ts`

断言：
- 当 `PATCH /api/session/[sessionId]` 把状态改成 `FINISHED` 时，会调用统一 finalizer
- finalizer 会冻结：
  - 班级整体报告
  - 每位学生的个人报告
  - 汇总统计（参与人数、提交数、步骤覆盖、AI 使用、同步异常）
- AI 总结失败不会阻塞 `FINISHED`
- `close-stale-sessions.ts` 会把超过一天的 `ACTIVE` 课堂改为 `FINISHED`，并复用同一个 finalizer

**Step 2: Run tests to verify they fail**

Run:
- `node scripts/tests/test-session-finalization.ts`
- `node scripts/tests/test-close-stale-sessions.ts`

Expected: FAIL

**Step 3: Write minimal implementation**

最小实现：
- `PATCH /api/session/[sessionId]` 在 `status === 'FINISHED'` 时调用 `finalizeSession`
- `finalizeSession`
  - 读取 `ClassSession`、`StudentState`、`InteractionLog`
  - 生成 deterministic 班级报告与个人报告
  - best-effort 调用 `generate-ai-session-summary`
  - 把分析失败写日志和管理员侧可追踪状态，不回传技术错误给教师端
- `scripts/ops/close-stale-sessions.ts`
  - 筛选 `startTime < now - 24h && status='ACTIVE'`
  - 逐个调用同一 finalizer

**Step 4: Run tests to verify they pass**

Run:
- `node scripts/tests/test-session-finalization.ts`
- `node scripts/tests/test-close-stale-sessions.ts`

Expected: PASS

### Task 7: 完成浏览器验证、文档更新与部署落地说明

**Files:**
- Modify: `docs/ProjectDescription.md`
- Modify: `AGENTS.md`
- Create: `docs/operations/classroom-finalization-and-autoclose.md`
- Test: `tests/l2d-live-classroom-sync.spec.ts`
- Test: `tests/lsum-live-classroom-sync.spec.ts`
- Test: `tests/classroom-session-finalization.spec.ts`

**Step 1: Add / update verification coverage**

补充或更新 Playwright 验证，覆盖：
- `L-2d` 教师开课、学生加入、浏览步骤、提交、结束课堂
- `L-sum` 教师开课、学生加入、浏览步骤、提交、结束课堂
- 结束课堂后可看到冻结报告

**Step 2: Run full verification**

Run:
- `npx prisma validate`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run test:integration`

Expected: 全部 PASS；若失败，优先修复统一框架回归，再修课程页适配

**Step 3: Update docs**

更新：
- `docs/ProjectDescription.md`
  - 记录统一同步框架、统一埋点框架、结束课堂固化分析与自动关闭治理
- `docs/operations/classroom-finalization-and-autoclose.md`
  - 记录部署后的手动执行、定时执行、管理员排查入口

**Step 4: Commit**

```bash
git add prisma src scripts tests docs AGENTS.md
git commit -m "feat: unify classroom sync analytics and session finalization"
```

## 执行顺序与子代理拆分

按子代理优先原则，推荐按以下顺序执行：

1. `Task 1` 单独执行：Prisma 与 API 契约最先落地，避免后续 hook 和课程页返工。
2. `Task 2 + Task 3` 可串行但同一阶段完成：先立共享同步层，再立共享埋点层。
3. `Task 4` 与 `Task 5` 可分别派给独立实现子代理，但写权限需分离到各自课程目录。
4. `Task 6` 独立执行：结束课堂与自动关闭逻辑集中在后端与脚本层，不与课程页共享写集。
5. `Task 7` 作为总验证与收口阶段执行。

## 设计边界

- 本轮明确升级 Prisma，不再受限于旧的 `StudentState @@unique([sessionId, userId])`。
- 本轮不为 `L-2c` 单独补丁；共享框架落地后，未来课程默认走新框架，`L-2c` 可按需要再迁移。
- 教师端不显示技术性错误；技术故障只进入日志、管理员端与后台固化状态。
- 结束课堂不做“闭环守卫”；教师点击结束即视为课堂应停止，此时系统要做的是固化数据与分析产物。
